import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/apikeys";

// GET /api/v1/incidents/:number — full detail with timeline
export async function GET(req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { number } = await ctx.params;
  const incident = await prisma.incident.findUnique({
    where: { number: parseInt(number, 10) || -1 },
    include: {
      service: true,
      events: { orderBy: { createdAt: "asc" }, include: { user: true } },
      statusUpdates: { orderBy: { createdAt: "asc" }, include: { author: true } },
      actionItems: { include: { jiraLinks: true } },
    },
  });
  if (!incident) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    incident: {
      number: incident.number,
      title: incident.title,
      summary: incident.summary,
      severity: incident.severity,
      status: incident.status,
      service: incident.service ? { slug: incident.service.slug, name: incident.service.name } : null,
      declared_at: incident.declaredAt.toISOString(),
      acknowledged_at: incident.acknowledgedAt?.toISOString() ?? null,
      mitigated_at: incident.mitigatedAt?.toISOString() ?? null,
      resolved_at: incident.resolvedAt?.toISOString() ?? null,
      timeline: incident.events.map((e) => ({
        kind: e.kind,
        message: e.message,
        by: e.user?.name ?? null,
        at: e.createdAt.toISOString(),
      })),
      status_updates: incident.statusUpdates.map((u) => ({
        body: u.body,
        status: u.status,
        by: u.author.name,
        at: u.createdAt.toISOString(),
      })),
      action_items: incident.actionItems.map((a) => ({
        title: a.title,
        status: a.status,
        priority: a.priority,
        jira: a.jiraLinks[0]?.issueKey ?? null,
      })),
    },
  });
}
