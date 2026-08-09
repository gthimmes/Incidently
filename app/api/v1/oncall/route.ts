import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/apikeys";
import { whoIsOnCall } from "@/lib/escalation";

// GET /api/v1/oncall — who is on call right now, per schedule
export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const schedules = await prisma.schedule.findMany();
  const oncall = await Promise.all(
    schedules.map(async (s) => {
      const user = await whoIsOnCall(s.id);
      return {
        schedule: s.name,
        on_call: user ? { name: user.name, email: user.email } : null,
      };
    }),
  );
  return NextResponse.json({ oncall });
}
