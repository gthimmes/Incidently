// Slack broadcasting.
//
// Incident lifecycle events broadcast to a Slack channel. Same pattern as
// SMS/voice: without SLACK_WEBHOOK_URL every message is recorded through
// the simulator (visible in the Notifications feed); with it, messages
// post to a real Slack incoming webhook. No code changes to go live.

import { prisma } from "./db";
import { send } from "./notify";

const CHANNEL_NAME = "#incidents";

export async function broadcastToSlack(opts: {
  text: string;
  incidentId?: string;
}): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_URL;

  if (!webhook) {
    // zero-cost simulation — shows up in the Notifications feed
    await send({
      channel: "slack",
      recipient: CHANNEL_NAME,
      body: opts.text,
      incidentId: opts.incidentId,
    });
    return;
  }

  let ok = false;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: opts.text }),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  await prisma.notification.create({
    data: {
      channel: "slack",
      recipient: CHANNEL_NAME,
      body: opts.text,
      status: ok ? "sent" : "failed",
      provider: "slack-webhook",
      incidentId: opts.incidentId,
    },
  });
}
