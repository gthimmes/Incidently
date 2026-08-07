import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const item = await prisma.actionItem.create({
    data: {
      incidentId: id,
      title: body.title,
      description: body.description,
      priority: body.priority ?? "medium",
      kind: body.kind ?? "remediation",
      assigneeId: body.assigneeId || null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    },
  });
  await prisma.incidentEvent.create({
    data: { incidentId: id, kind: "action_item", message: `Action item created: ${body.title}` },
  });
  return NextResponse.json(item, { status: 201 });
}
