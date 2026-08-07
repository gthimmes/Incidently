import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.priority) patch.priority = body.priority;
  if ("assigneeId" in body) patch.assigneeId = body.assigneeId || null;
  if ("dueAt" in body) patch.dueAt = body.dueAt ? new Date(body.dueAt) : null;
  const item = await prisma.actionItem.update({ where: { id }, data: patch });
  return NextResponse.json(item);
}
