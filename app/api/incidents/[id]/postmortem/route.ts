import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const fields = [
    "status", "summary", "impact", "rootCause", "timelineNotes",
    "whatWentWell", "whatWentPoorly", "whereWeGotLucky",
  ] as const;
  const patch: Record<string, string> = {};
  for (const f of fields) if (typeof body[f] === "string") patch[f] = body[f];

  const pm = await prisma.postmortem.upsert({
    where: { incidentId: id },
    create: { incidentId: id, ...patch },
    update: patch,
  });
  return NextResponse.json(pm);
}
