import { NextRequest, NextResponse } from "next/server";
import { sendTestDelivery } from "@/lib/webhooks";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const delivery = await sendTestDelivery(id);
  return NextResponse.json(delivery, { status: 201 });
}
