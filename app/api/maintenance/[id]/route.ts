import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (body.action !== "cancel") {
    return NextResponse.json({ error: "only { action: 'cancel' } is supported" }, { status: 400 });
  }
  const window = await prisma.maintenanceWindow.update({
    where: { id },
    data: { cancelled: true },
  });
  return NextResponse.json(window);
}
