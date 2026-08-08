import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { promoteAlert } from "@/lib/alerts";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();

  if (body.action === "promote") {
    const result = await promoteAlert(id);
    return NextResponse.json(result);
  }

  if (body.status === "acked" || body.status === "resolved") {
    const alert = await prisma.alert.update({
      where: { id },
      data: {
        status: body.status,
        resolvedAt: body.status === "resolved" ? new Date() : undefined,
      },
    });
    return NextResponse.json(alert);
  }

  return NextResponse.json({ error: "nothing to do" }, { status: 400 });
}
