import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDefaultActor } from "@/lib/actions";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (!body.message) return NextResponse.json({ error: "message required" }, { status: 400 });
  const actor = body.actorId
    ? await prisma.user.findUniqueOrThrow({ where: { id: body.actorId } })
    : await getDefaultActor();
  const event = await prisma.incidentEvent.create({
    data: { incidentId: id, kind: "note", message: body.message, userId: actor.id },
  });
  return NextResponse.json(event, { status: 201 });
}
