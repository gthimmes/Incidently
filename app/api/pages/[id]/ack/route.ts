import { NextRequest, NextResponse } from "next/server";
import { acknowledgePage } from "@/lib/actions";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const page = await acknowledgePage(id);
  return NextResponse.json(page);
}
