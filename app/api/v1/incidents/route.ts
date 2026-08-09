import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/apikeys";
import { declareIncident } from "@/lib/actions";

function serialize(inc: {
  number: number; title: string; summary: string | null; severity: string; status: string;
  declaredAt: Date; acknowledgedAt: Date | null; resolvedAt: Date | null;
  service: { slug: string; name: string } | null;
}) {
  return {
    number: inc.number,
    title: inc.title,
    summary: inc.summary,
    severity: inc.severity,
    status: inc.status,
    service: inc.service ? { slug: inc.service.slug, name: inc.service.name } : null,
    declared_at: inc.declaredAt.toISOString(),
    acknowledged_at: inc.acknowledgedAt?.toISOString() ?? null,
    resolved_at: inc.resolvedAt?.toISOString() ?? null,
  };
}

// GET /api/v1/incidents?status=open|resolved&limit=20
export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100);
  const where =
    status === "open" ? { status: { not: "resolved" } } : status === "resolved" ? { status: "resolved" } : {};

  const incidents = await prisma.incident.findMany({
    where,
    include: { service: true },
    orderBy: { number: "desc" },
    take: limit,
  });
  return NextResponse.json({ incidents: incidents.map(serialize) });
}

// POST /api/v1/incidents — declare programmatically (pages on-call!)
export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.severity) {
    return NextResponse.json({ error: "title and severity are required" }, { status: 400 });
  }
  if (!["sev1", "sev2", "sev3", "sev4"].includes(body.severity)) {
    return NextResponse.json({ error: "severity must be sev1..sev4" }, { status: 400 });
  }
  let serviceId: string | undefined;
  if (body.service) {
    const service = await prisma.service.findUnique({ where: { slug: body.service } });
    if (!service) return NextResponse.json({ error: `unknown service slug: ${body.service}` }, { status: 404 });
    serviceId = service.id;
  }

  const incident = await declareIncident({
    title: body.title,
    summary: body.summary,
    severity: body.severity,
    serviceId,
  });
  const full = await prisma.incident.findUniqueOrThrow({
    where: { id: incident.id },
    include: { service: true },
  });
  return NextResponse.json({ incident: serialize(full) }, { status: 201 });
}
