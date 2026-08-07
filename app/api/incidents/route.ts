import { NextRequest, NextResponse } from "next/server";
import { declareIncident } from "@/lib/actions";
import { sweepEscalations } from "@/lib/escalation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title || !body.severity) {
    return NextResponse.json({ error: "title and severity are required" }, { status: 400 });
  }
  const incident = await declareIncident({
    title: body.title,
    summary: body.summary,
    severity: body.severity,
    serviceId: body.serviceId,
    actorId: body.actorId,
  });
  return NextResponse.json(incident, { status: 201 });
}

// opportunistic escalation sweep endpoint (poor man's cron)
export async function GET() {
  const result = await sweepEscalations();
  return NextResponse.json(result);
}
