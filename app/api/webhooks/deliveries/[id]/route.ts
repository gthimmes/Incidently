import { NextRequest, NextResponse } from "next/server";
import { redeliver } from "@/lib/webhooks";

// POST = redeliver this delivery's exact payload as a new attempt
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const delivery = await redeliver(id);
  return NextResponse.json(delivery, { status: 201 });
}
