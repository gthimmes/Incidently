import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { changeIncidentStatus, getDefaultActor } from "@/lib/actions";
import { SEVERITIES } from "@/lib/constants";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();

  if (body.status) {
    const incident = await changeIncidentStatus(id, body.status, body.actorId);
    return NextResponse.json(incident);
  }

  if (body.severity) {
    const actor = await getDefaultActor();
    const before = await prisma.incident.findUniqueOrThrow({ where: { id } });
    const incident = await prisma.incident.update({ where: { id }, data: { severity: body.severity } });
    const from = SEVERITIES[before.severity as keyof typeof SEVERITIES]?.label ?? before.severity;
    const to = SEVERITIES[body.severity as keyof typeof SEVERITIES]?.label ?? body.severity;
    await prisma.incidentEvent.create({
      data: { incidentId: id, kind: "severity_change", message: `Severity changed: ${from} → ${to}`, userId: actor.id },
    });
    return NextResponse.json(incident);
  }

  return NextResponse.json({ error: "nothing to update" }, { status: 400 });
}
