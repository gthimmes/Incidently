import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { newWebhookSecret, WEBHOOK_EVENTS } from "@/lib/webhooks";

export async function GET() {
  const subs = await prisma.webhookSubscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      deliveries: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { deliveries: true } },
    },
  });
  // never return secrets on reads
  return NextResponse.json(
    subs.map((s) => {
      const safe: Partial<typeof s> = { ...s };
      delete safe.secret;
      return safe;
    }),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.url) {
    return NextResponse.json({ error: "name and url required" }, { status: 400 });
  }
  let url: URL;
  try {
    url = new URL(body.url);
  } catch {
    return NextResponse.json({ error: "url must be a valid absolute URL" }, { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "url must be http(s)" }, { status: 400 });
  }
  const events: string[] = Array.isArray(body.events) && body.events.length > 0 ? body.events : ["*"];
  const invalid = events.filter((e) => e !== "*" && !(WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `unknown events: ${invalid.join(", ")}` }, { status: 400 });
  }

  const secret = newWebhookSecret();
  const sub = await prisma.webhookSubscription.create({
    data: { name: body.name, url: body.url, secret, events: JSON.stringify(events) },
  });
  // the secret is returned exactly once, at creation
  return NextResponse.json(
    { id: sub.id, name: sub.name, url: sub.url, events, secret },
    { status: 201 },
  );
}
