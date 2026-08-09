import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function csvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/export/incidents — full incident history as CSV
export async function GET() {
  const incidents = await prisma.incident.findMany({
    include: { service: true, roles: { include: { user: true } }, postmortem: true },
    orderBy: { number: "asc" },
  });

  const header = [
    "number", "title", "severity", "status", "service", "commander",
    "declared_at", "acknowledged_at", "mitigated_at", "resolved_at",
    "mtta_minutes", "mttr_minutes", "postmortem_status",
  ];
  const rows = incidents.map((inc) => {
    const commander = inc.roles.find((r) => r.role === "commander")?.user.name ?? "";
    const mtta = inc.acknowledgedAt
      ? Math.round((inc.acknowledgedAt.getTime() - inc.declaredAt.getTime()) / 60_000)
      : "";
    const mttr = inc.resolvedAt
      ? Math.round((inc.resolvedAt.getTime() - inc.declaredAt.getTime()) / 60_000)
      : "";
    return [
      `INC-${inc.number}`, inc.title, inc.severity, inc.status, inc.service?.name ?? "",
      commander, inc.declaredAt.toISOString(), inc.acknowledgedAt?.toISOString() ?? "",
      inc.mitigatedAt?.toISOString() ?? "", inc.resolvedAt?.toISOString() ?? "",
      mtta, mttr, inc.postmortem?.status ?? "",
    ].map(csvField).join(",");
  });

  const csv = [header.join(","), ...rows].join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="incidently-incidents-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
