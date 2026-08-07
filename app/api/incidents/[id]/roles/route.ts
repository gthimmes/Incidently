import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { INCIDENT_ROLES } from "@/lib/constants";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { role, userId } = await req.json();
  if (!role || !userId) {
    return NextResponse.json({ error: "role and userId required" }, { status: 400 });
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const assignment = await prisma.incidentRole.upsert({
    where: { incidentId_role: { incidentId: id, role } },
    create: { incidentId: id, role, userId },
    update: { userId },
  });
  const roleLabel = INCIDENT_ROLES[role as keyof typeof INCIDENT_ROLES]?.label ?? role;
  await prisma.incidentEvent.create({
    data: { incidentId: id, kind: "role_assigned", message: `${user.name} assigned as ${roleLabel}`, userId },
  });
  return NextResponse.json(assignment);
}
