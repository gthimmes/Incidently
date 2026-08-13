// Outbound webhooks: external systems subscribe to incident events and
// receive HMAC-SHA256 signed POSTs. Every attempt is logged as a
// WebhookDelivery and can be redelivered.

import crypto from "crypto";
import { prisma } from "./db";

export const WEBHOOK_EVENTS = [
  "incident.declared",
  "incident.status_changed",
  "incident.resolved",
  "incident.update_published",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const DELIVERY_TIMEOUT_MS = 5_000;

export function newWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

/** Value for the X-Incidently-Signature header: sha256=<hmac hex of body>. */
export function signPayload(secret: string, body: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

/** Does a subscription's events JSON (["*"] or explicit list) cover this event? */
export function subscriptionMatches(eventsJson: string, event: string): boolean {
  try {
    const events = JSON.parse(eventsJson);
    return Array.isArray(events) && (events.includes("*") || events.includes(event));
  } catch {
    return false;
  }
}

type Subscription = { id: string; url: string; secret: string };

async function deliver(sub: Subscription, event: string, body: string) {
  const delivery = await prisma.webhookDelivery.create({
    data: { subscriptionId: sub.id, event, payload: body },
  });
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    const res = await fetch(sub.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Incidently-Webhook/1.0",
        "x-incidently-event": event,
        "x-incidently-delivery": delivery.id,
        "x-incidently-signature": signPayload(sub.secret, body),
      },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: res.ok ? "success" : "failed",
        statusCode: res.status,
        error: res.ok ? null : `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      },
    });
  } catch (e) {
    return prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "failed",
        error: e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : String(e),
        durationMs: Date.now() - started,
      },
    });
  }
}

/** Fans an event out to every active, matching subscription. Never throws. */
export async function emitWebhookEvent(event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const subs = await prisma.webhookSubscription.findMany({ where: { active: true } });
    const matching = subs.filter((s) => subscriptionMatches(s.events, event));
    if (matching.length === 0) return [];
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data });
    return await Promise.all(matching.map((s) => deliver(s, event, body)));
  } catch (e) {
    console.error("[incidently] webhook emit failed:", e);
    return [];
  }
}

/** Sends a signed ping to one subscription regardless of its event filter. */
export async function sendTestDelivery(subscriptionId: string) {
  const sub = await prisma.webhookSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  const body = JSON.stringify({
    event: "ping",
    timestamp: new Date().toISOString(),
    data: { message: "Incidently webhook test — signature is valid if you can verify this body." },
  });
  return deliver(sub, "ping", body);
}

/** Re-sends a past delivery's exact payload as a new delivery attempt. */
export async function redeliver(deliveryId: string) {
  const prior = await prisma.webhookDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { subscription: true },
  });
  return deliver(prior.subscription, prior.event, prior.payload);
}

/** Compact incident snapshot used as webhook payload data. */
export function incidentSnapshot(incident: {
  number: number;
  title: string;
  severity: string;
  status: string;
  declaredAt: Date;
  resolvedAt?: Date | null;
}, serviceName?: string | null) {
  return {
    incident: `INC-${incident.number}`,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    service: serviceName ?? null,
    declared_at: incident.declaredAt.toISOString(),
    resolved_at: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
  };
}
