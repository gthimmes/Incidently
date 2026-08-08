import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const rb = await prisma.runbook.create({
    data: { title: body.title, content: body.content ?? "", serviceId: body.serviceId || null },
  });
  return NextResponse.json(rb, { status: 201 });
}
