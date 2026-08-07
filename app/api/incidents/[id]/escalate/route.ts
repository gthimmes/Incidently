import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fireLevel } from "@/lib/escalation";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const maxPage = await prisma.page.findFirst({
    where: { incidentId: id },
    orderBy: { level: "desc" },
  });
  const nextLevel = (maxPage?.level ?? 0) + 1;
  const result = await fireLevel(id, nextLevel);
  if (!result.paged.length) {
    return NextResponse.json({ error: "No further escalation levels or no targets resolved" }, { status: 400 });
  }
  await prisma.incidentEvent.create({
    data: { incidentId: id, kind: "escalated", message: `Manually escalated to level ${nextLevel}` },
  });
  return NextResponse.json(result);
}
