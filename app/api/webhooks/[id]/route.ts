import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active (boolean) required" }, { status: 400 });
  }
  const sub = await prisma.webhookSubscription.update({ where: { id }, data: { active: body.active } });
  const safe: Partial<typeof sub> = { ...sub };
  delete safe.secret;
  return NextResponse.json(safe);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await prisma.webhookSubscription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
