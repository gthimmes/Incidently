import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { broadcastToSlack } from "@/lib/slack";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title || !body.serviceId || !body.startsAt || !body.endsAt) {
    return NextResponse.json(
      { error: "title, serviceId, startsAt, and endsAt are required" },
      { status: 400 },
    );
  }
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!(startsAt < endsAt)) {
    return NextResponse.json({ error: "endsAt must be after startsAt" }, { status: 400 });
  }
  const service = await prisma.service.findUnique({ where: { id: body.serviceId } });
  if (!service) return NextResponse.json({ error: "unknown service" }, { status: 404 });

  const window = await prisma.maintenanceWindow.create({
    data: {
      title: body.title,
      notes: body.notes,
      serviceId: body.serviceId,
      startsAt,
      endsAt,
    },
  });
  await broadcastToSlack({
    text: `:wrench: Maintenance scheduled for *${service.name}*: ${body.title} (${startsAt.toLocaleString()} → ${endsAt.toLocaleString()})`,
  });
  return NextResponse.json(window, { status: 201 });
}
