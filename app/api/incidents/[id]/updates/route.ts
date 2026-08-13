import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDefaultActor } from "@/lib/actions";
import { broadcastToSlack } from "@/lib/slack";
import { emitWebhookEvent, incidentSnapshot } from "@/lib/webhooks";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (!body.body) return NextResponse.json({ error: "body required" }, { status: 400 });

  const actor = body.actorId
    ? await prisma.user.findUniqueOrThrow({ where: { id: body.actorId } })
    : await getDefaultActor();
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id } });

  const update = await prisma.statusUpdate.create({
    data: { incidentId: id, body: body.body, status: incident.status, authorId: actor.id },
  });
  await prisma.incidentEvent.create({
    data: { incidentId: id, kind: "update_published", message: `Status update published: "${body.body.slice(0, 120)}"`, userId: actor.id },
  });
  await broadcastToSlack({
    incidentId: id,
    text: `:mega: *INC-${incident.number} update* — ${body.body}`,
  });
  const svc = incident.serviceId
    ? await prisma.service.findUnique({ where: { id: incident.serviceId } })
    : null;
  await emitWebhookEvent("incident.update_published", {
    ...incidentSnapshot(incident, svc?.name),
    update: body.body,
  });
  return NextResponse.json(update, { status: 201 });
}
