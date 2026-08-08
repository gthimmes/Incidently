import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [incidents, services, runbooks, postmortems] = await Promise.all([
    prisma.incident.findMany({
      where: { OR: [{ title: { contains: q } }, { summary: { contains: q } }] },
      select: { id: true, number: true, title: true, status: true, severity: true },
      orderBy: { number: "desc" },
      take: 6,
    }),
    prisma.service.findMany({
      where: { name: { contains: q } },
      select: { id: true, name: true, status: true },
      take: 4,
    }),
    prisma.runbook.findMany({
      where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      select: { id: true, title: true },
      take: 4,
    }),
    prisma.postmortem.findMany({
      where: {
        OR: [
          { summary: { contains: q } },
          { rootCause: { contains: q } },
          { incident: { title: { contains: q } } },
        ],
      },
      select: { id: true, status: true, incident: { select: { number: true, title: true } } },
      take: 4,
    }),
  ]);

  // Numeric query also matches incident numbers (e.g. "1007" or "INC-1007").
  const numMatch = q.match(/(?:inc-?)?(\d{3,})/i);
  let byNumber: typeof incidents = [];
  if (numMatch) {
    byNumber = await prisma.incident.findMany({
      where: { number: parseInt(numMatch[1], 10) },
      select: { id: true, number: true, title: true, status: true, severity: true },
      take: 1,
    });
  }

  const seen = new Set<string>();
  const incidentResults = [...byNumber, ...incidents].filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  return NextResponse.json({
    results: [
      ...incidentResults.map((i) => ({
        kind: "incident",
        id: i.id,
        title: `INC-${i.number} ${i.title}`,
        meta: `${i.severity.toUpperCase()} · ${i.status}`,
        href: `/incidents/${i.id}`,
      })),
      ...services.map((s) => ({
        kind: "service",
        id: s.id,
        title: s.name,
        meta: s.status.replace("_", " "),
        href: "/services",
      })),
      ...runbooks.map((r) => ({
        kind: "runbook",
        id: r.id,
        title: r.title,
        meta: "runbook",
        href: `/runbooks/${r.id}`,
      })),
      ...postmortems.map((p) => ({
        kind: "postmortem",
        id: p.id,
        title: `Postmortem · INC-${p.incident.number} ${p.incident.title}`,
        meta: p.status.replace("_", " "),
        href: `/postmortems/${p.id}`,
      })),
    ],
  });
}
