import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const targetPct = Number(body.targetPct);
  const windowDays = Number(body.windowDays ?? 30);
  if (!Number.isFinite(targetPct) || targetPct <= 0 || targetPct >= 100) {
    return NextResponse.json({ error: "targetPct must be between 0 and 100" }, { status: 400 });
  }
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return NextResponse.json({ error: "unknown service" }, { status: 404 });

  const slo = await prisma.slo.upsert({
    where: { serviceId: id },
    create: { serviceId: id, targetPct, windowDays },
    update: { targetPct, windowDays },
  });
  return NextResponse.json(slo);
}
