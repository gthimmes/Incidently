import { prisma } from "@/lib/db";
import { SEVERITIES } from "@/lib/constants";
import { WeeklyBars, TrendLine, RowBars } from "./charts";

export const dynamic = "force-dynamic";

const WEEK = 7 * 24 * 3600_000;

function fmtMinutes(mins: number | null): string {
  if (mins == null || Number.isNaN(mins)) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

export default async function AnalyticsPage() {
  const since = new Date(Date.now() - 12 * WEEK);
  const incidents = await prisma.incident.findMany({
    where: { declaredAt: { gte: since } },
    include: { service: true },
    orderBy: { declaredAt: "asc" },
  });

  // weekly buckets (last 8 weeks for readability)
  const weeks = 8;
  const weekBuckets: { label: string; incidents: number; mttrVals: number[] }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(Date.now() - (i + 1) * WEEK);
    const end = new Date(Date.now() - i * WEEK);
    const inWeek = incidents.filter((inc) => inc.declaredAt >= start && inc.declaredAt < end);
    weekBuckets.push({
      label: end.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      incidents: inWeek.length,
      mttrVals: inWeek
        .filter((inc) => inc.resolvedAt)
        .map((inc) => (inc.resolvedAt!.getTime() - inc.declaredAt.getTime()) / 60_000),
    });
  }

  const resolved = incidents.filter((i) => i.resolvedAt);
  const acked = incidents.filter((i) => i.acknowledgedAt);
  const mtta = acked.length
    ? acked.reduce((a, i) => a + (i.acknowledgedAt!.getTime() - i.declaredAt.getTime()) / 60_000, 0) / acked.length
    : null;
  const mttr = resolved.length
    ? resolved.reduce((a, i) => a + (i.resolvedAt!.getTime() - i.declaredAt.getTime()) / 60_000, 0) / resolved.length
    : null;

  const bySeverity = Object.entries(SEVERITIES).map(([key, sev]) => ({
    label: `${sev.label} ${sev.name}`,
    value: incidents.filter((i) => i.severity === key).length,
    color: sev.color,
  }));

  const serviceCounts = new Map<string, number>();
  for (const inc of incidents) {
    const name = inc.service?.name ?? "No service";
    serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  }
  const byService = [...serviceCounts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const stats = [
    { label: "Incidents · 12w", value: String(incidents.length) },
    { label: "MTTA", value: fmtMinutes(mtta), hint: "mean time to acknowledge" },
    { label: "MTTR", value: fmtMinutes(mttr), hint: "mean time to resolve" },
    {
      label: "SEV1/SEV2 share",
      value: incidents.length
        ? `${Math.round((incidents.filter((i) => i.severity === "sev1" || i.severity === "sev2").length / incidents.length) * 100)}%`
        : "—",
    },
  ];

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-dim text-sm mt-0.5">Operational health over the last 12 weeks.</p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4" title={s.hint}>
            <p className="text-dim text-xs font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="card p-5">
          <h2 className="font-semibold mb-1">Incidents per week</h2>
          <p className="text-xs text-dim mb-4">Declared incidents, weekly</p>
          <WeeklyBars data={weekBuckets.map((w) => ({ label: w.label, value: w.incidents }))} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-1">MTTR trend</h2>
          <p className="text-xs text-dim mb-4">Mean minutes to resolve, weekly</p>
          <TrendLine
            data={weekBuckets.map((w) => ({
              label: w.label,
              value: w.mttrVals.length ? Math.round(w.mttrVals.reduce((a, b) => a + b, 0) / w.mttrVals.length) : null,
            }))}
            unit="m"
          />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-1">By severity</h2>
          <p className="text-xs text-dim mb-4">Last 12 weeks</p>
          <RowBars data={bySeverity} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold mb-1">By service</h2>
          <p className="text-xs text-dim mb-4">Last 12 weeks</p>
          <RowBars data={byService} />
        </section>
      </div>
    </div>
  );
}
