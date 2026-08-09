import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.action !== "revoke") {
    return NextResponse.json({ error: "only { action: 'revoke' } is supported" }, { status: 400 });
  }
  const key = await prisma.apiKey.update({ where: { id }, data: { revoked: true } });
  return NextResponse.json({ id: key.id, revoked: key.revoked });
}
