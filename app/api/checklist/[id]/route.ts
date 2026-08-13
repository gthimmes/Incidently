import { NextRequest, NextResponse } from "next/server";
import { toggleChecklistItem } from "@/lib/checklists";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "done (boolean) required" }, { status: 400 });
  }
  const item = await toggleChecklistItem(id, body.done, body.actorId);
  return NextResponse.json(item);
}
