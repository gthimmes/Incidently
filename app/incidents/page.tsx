import Link from "next/link";
import { prisma } from "@/lib/db";
import { SeverityBadge, StatusBadge, Avatar, TimeAgo, Duration } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const where =
    filter === "open"
      ? { status: { not: "resolved" } }
      : filter === "resolved"
        ? { status: "resolved" }
        : {};

  const incidents = await prisma.incident.findMany({
    where,
    include: { service: true, roles: { include: { user: true } }, postmortem: true },
    orderBy: { number: "desc" },
  });

  const tabs = [
    { key: undefined, label: "All" },
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="space-y-5 animate-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
          <p className="text-dim text-sm mt-0.5">{incidents.length} incident{incidents.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/incidents" className="btn btn-ghost" download>
            ⬇ Export CSV
          </a>
          <Link href="/incidents/declare" className="btn btn-danger">Declare Incident</Link>
        </div>
      </header>

      <div className="flex gap-1 border-b border-line">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <Link
              key={t.label}
              href={t.key ? `/incidents?filter=${t.key}` : "/incidents"}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active ? "border-accent text-white" : "border-transparent text-dim hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-dim text-xs uppercase tracking-wide border-b border-line">
              <th className="px-4 py-3 font-medium">Incident</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Commander</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Declared</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {incidents.map((inc) => {
              const commander = inc.roles.find((r) => r.role === "commander")?.user;
              return (
                <tr key={inc.id} className="hover:bg-elevated/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/incidents/${inc.id}`} className="font-medium hover:text-accent">
                      <span className="text-dim font-mono text-xs mr-2">INC-{inc.number}</span>
                      {inc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                  <td className="px-4 py-3 text-dim">{inc.service?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {commander ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={commander.name} color={commander.avatarColor} size={22} />
                        <span className="text-dim">{commander.name.split(" ")[0]}</span>
                      </span>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-dim">
                    <Duration from={inc.declaredAt} to={inc.resolvedAt} />
                  </td>
                  <td className="px-4 py-3 text-dim"><TimeAgo date={inc.declaredAt} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
