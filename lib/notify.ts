// Notification engine.
//
// Every outbound message goes through a provider. By default everything runs
// through the Simulator provider (free, records deliveries in the DB so the UI
// can show exactly what WOULD have been sent). To go live with real SMS/voice,
// set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER — the
// Twilio adapter below takes over automatically. No code changes required.

import { prisma } from "./db";

export type Channel = "sms" | "voice" | "email" | "slack" | "push";

export interface SendRequest {
  channel: Channel;
  recipient: string; // phone / email / channel name
  body: string;
  userId?: string;
  incidentId?: string;
  pageId?: string;
}

interface ProviderResult {
  status: "sent" | "delivered" | "failed" | "simulated";
  provider: string;
}

// ─── Twilio adapter (live SMS + voice) ──────────────────────────────────────

async function twilioSend(req: SendRequest): Promise<ProviderResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  if (req.channel === "sms") {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: req.recipient, From: from, Body: req.body }),
      }
    );
    return { status: res.ok ? "sent" : "failed", provider: "twilio" };
  }

  if (req.channel === "voice") {
    // Text-to-speech call via TwiML
    const twiml = `<Response><Say voice="alice">${req.body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</Say><Pause length="1"/><Say>Press any key to acknowledge.</Say></Response>`;
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: req.recipient, From: from, Twiml: twiml }),
      }
    );
    return { status: res.ok ? "sent" : "failed", provider: "twilio" };
  }

  return simulatorSend(req);
}

// ─── Simulator (default, zero-cost) ─────────────────────────────────────────

async function simulatorSend(_req: SendRequest): Promise<ProviderResult> {
  // Simulates network latency, always succeeds. The Notification row itself
  // is the visible artifact — the UI renders a live delivery feed from it.
  return { status: "simulated", provider: "simulator" };
}

// ─── Engine ─────────────────────────────────────────────────────────────────

function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

export async function send(req: SendRequest) {
  const useTwilio =
    twilioConfigured() && (req.channel === "sms" || req.channel === "voice");

  const result = useTwilio ? await twilioSend(req) : await simulatorSend(req);

  return prisma.notification.create({
    data: {
      channel: req.channel,
      recipient: req.recipient,
      body: req.body,
      status: result.status,
      provider: result.provider,
      userId: req.userId,
      incidentId: req.incidentId,
      pageId: req.pageId,
    },
  });
}

/** Page a user across all their channels (voice+sms for sev1/sev2, sms otherwise). */
export async function pageUser(opts: {
  userId: string;
  incidentId: string;
  pageId: string;
  severity: string;
  incidentNumber: number;
  title: string;
}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: opts.userId } });
  const body = `[Incidently] ${opts.severity.toUpperCase()} INC-${opts.incidentNumber}: ${opts.title}. You are being paged — acknowledge in the app.`;

  const sends: Promise<unknown>[] = [];
  if (user.phone) {
    sends.push(send({ channel: "sms", recipient: user.phone, body, userId: user.id, incidentId: opts.incidentId, pageId: opts.pageId }));
    if (opts.severity === "sev1" || opts.severity === "sev2") {
      sends.push(send({ channel: "voice", recipient: user.phone, body, userId: user.id, incidentId: opts.incidentId, pageId: opts.pageId }));
    }
  }
  sends.push(send({ channel: "email", recipient: user.email, body, userId: user.id, incidentId: opts.incidentId, pageId: opts.pageId }));
  sends.push(send({ channel: "push", recipient: user.email, body, userId: user.id, incidentId: opts.incidentId, pageId: opts.pageId }));
  await Promise.all(sends);
}
