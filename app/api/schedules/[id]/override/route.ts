import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { whoIsOnCall } from "@/lib/escalation";

// Take an on-call override: creates a shift for the chosen user starting
// now. whoIsOnCall picks the most-recently-started active shift, so the
// override naturally wins over the underlying rotation, which resumes
// automatically when the override ends.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (!body.userId || !body.hours) {
    return NextResponse.json({ error: "userId and hours required" }, { status: 400 });
  }
  const hours = Math.min(Math.max(Number(body.hours), 1), 24 * 14);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: body.userId } });
  const previous = await whoIsOnCall(id);

  const shift = await prisma.shift.create({
    data: {
      scheduleId: id,
      userId: user.id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + hours * 3600_000),
    },
  });

  return NextResponse.json({
    shift,
    message: `${user.name} is now on call${previous ? ` (overriding ${previous.name})` : ""} for ${hours}h`,
  });
}
