import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const rb = await prisma.runbook.update({
    where: { id },
    data: {
      title: body.title,
      content: body.content ?? "",
      serviceId: body.serviceId || null,
    },
  });
  return NextResponse.json(rb);
}
