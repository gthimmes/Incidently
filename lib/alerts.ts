// Alert ingestion engine.
//
// Monitoring tools (Grafana, Datadog, CloudWatch, anything that can POST
// JSON) send alerts to /api/ingest with the shared ingest token. Alerts
// dedup by dedupKey, and the promotion rules turn the right alerts into
// incidents automatically — paging on-call without a human in the loop:
//
//   critical alert on a tier-1 service  → auto-declare SEV1 incident
//   critical alert on tier-2/3          → auto-declare SEV2 incident
//   service already has an open incident → attach alert to it instead
//   warning / info                       → stay in the alert feed for triage

import { prisma } from "./db";
import { declareIncident } from "./actions";
import crypto from "crypto";

export interface IngestPayload {
  title: string;
  description?: string;
  severity?: "critical" | "warning" | "info";
  status?: "firing" | "resolved";
  service?: string; // service slug
  dedup_key?: string;
  source?: string;
  [key: string]: unknown;
}

export async function getIngestToken(): Promise<string> {
  if (process.env.INGEST_TOKEN) return process.env.INGEST_TOKEN;
  const row = await prisma.setting.findUnique({ where: { key: "ingest_token" } });
  if (row) return row.value;
  const token = `ink_${crypto.randomBytes(18).toString("hex")}`;
  await prisma.setting.create({ data: { key: "ingest_token", value: token } });
  return token;
}

export async function ingestAlert(payload: IngestPayload) {
  const severity = payload.severity ?? "warning";
  const source = payload.source ?? "custom";
  const service = payload.service
    ? await prisma.service.findUnique({ where: { slug: payload.service } })
    : null;

  // A "resolved" signal from the source closes matching open alerts.
  if (payload.status === "resolved" && payload.dedup_key) {
    const { count } = await prisma.alert.updateMany({
      where: { dedupKey: payload.dedup_key, status: { not: "resolved" } },
      data: { status: "resolved", resolvedAt: new Date() },
    });
    return { action: "auto_resolved", resolved: count };
  }

  // Dedup: same key still open → bump the counter instead of a new row.
  if (payload.dedup_key) {
    const existing = await prisma.alert.findFirst({
      where: { dedupKey: payload.dedup_key, status: { not: "resolved" } },
    });
    if (existing) {
      const updated = await prisma.alert.update({
        where: { id: existing.id },
        data: { count: { increment: 1 }, lastSeenAt: new Date() },
      });
      return { action: "deduplicated", alert: updated };
    }
  }

  const alert = await prisma.alert.create({
    data: {
      title: payload.title,
      description: payload.description,
      severity,
      source,
      dedupKey: payload.dedup_key ?? null,
      serviceId: service?.id ?? null,
      payload: JSON.stringify(payload).slice(0, 4000),
    },
  });

  // Promotion rules.
  if (severity === "critical" && service) {
    const openIncident = await prisma.incident.findFirst({
      where: { serviceId: service.id, status: { not: "resolved" } },
      orderBy: { declaredAt: "desc" },
    });

    if (openIncident) {
      // Don't storm the on-call with a second incident — attach.
      await prisma.alert.update({
        where: { id: alert.id },
        data: { incidentId: openIncident.id },
      });
      await prisma.incidentEvent.create({
        data: {
          incidentId: openIncident.id,
          kind: "note",
          message: `Alert attached from ${source}: ${payload.title}`,
        },
      });
      return { action: "attached_to_incident", alert, incidentId: openIncident.id };
    }

    const incidentSeverity = service.tier === 1 ? "sev1" : "sev2";
    const incident = await declareIncident({
      title: payload.title,
      summary: payload.description
        ? `Auto-declared from ${source} alert: ${payload.description}`
        : `Auto-declared from a critical ${source} alert.`,
      severity: incidentSeverity,
      serviceId: service.id,
    });
    await prisma.alert.update({
      where: { id: alert.id },
      data: { incidentId: incident.id },
    });
    await prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        kind: "note",
        message: `Incident auto-declared from ${source} alert (${severity} on tier-${service.tier} ${service.name})`,
      },
    });
    return { action: "incident_declared", alert, incidentId: incident.id };
  }

  return { action: "created", alert };
}

/** Manually promote an alert from the feed into an incident. */
export async function promoteAlert(alertId: string) {
  const alert = await prisma.alert.findUniqueOrThrow({
    where: { id: alertId },
    include: { service: true },
  });
  if (alert.incidentId) return { incidentId: alert.incidentId, already: true };

  const severity =
    alert.severity === "critical" ? (alert.service?.tier === 1 ? "sev1" : "sev2") : "sev3";
  const incident = await declareIncident({
    title: alert.title,
    summary: alert.description ?? `Promoted from ${alert.source} alert.`,
    severity,
    serviceId: alert.serviceId ?? undefined,
  });
  await prisma.alert.update({
    where: { id: alertId },
    data: { incidentId: incident.id, status: "acked" },
  });
  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      kind: "note",
      message: `Promoted from ${alert.source} alert: ${alert.title}${alert.count > 1 ? ` (fired ${alert.count}×)` : ""}`,
    },
  });
  return { incidentId: incident.id, already: false };
}
