import Link from "next/link";
import { prisma } from "@/lib/db";
import { whoIsOnCall } from "@/lib/escalation";
import { SeverityBadge, StatusBadge, Avatar, TimeAgo, ServiceStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

function fmtMinutes(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

export default async function Dashboard() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000);

  const [openIncidents, resolved30d, services, schedules, recentEvents] = await Promise.all([
    prisma.incident.findMany({
      where: { status: { not: "resolved" } },
      include: { service: true, roles: { include: { user: true } } },
      orderBy: { declaredAt: "desc" },
    }),
    prisma.incident.findMany({
      where: { status: "resolved", declaredAt: { gte: thirtyDaysAgo } },
    }),
    prisma.service.findMany({ orderBy: { tier: "asc" } }),
    prisma.schedule.findMany(),
    prisma.incidentEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: true, incident: true },
    }),
  ]);

  const onCallNow = await Promise.all(
    schedules.map(async (s) => ({ schedule: s, user: await whoIsOnCall(s.id) }))
  );

  const mtta =
    resolved30d.length > 0
      ? resolved30d.reduce((acc, i) => acc + (i.acknowledgedAt ? (i.acknowledgedAt.getTime() - i.declaredAt.getTime()) / 60_000 : 0), 0) / resolved30d.length
      : null;
  const mttr =
    resolved30d.length > 0
      ? resolved30d.reduce((acc, i) => acc + (i.resolvedAt ? (i.resolvedAt.getTime() - i.declaredAt.getTime()) / 60_000 : 0), 0) / resolved30d.length
      : null;

  const degraded = services.filter((s) => s.status !== "operational");

  return (
    <div className="space-y-6 animate-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-dim text-sm mt-0.5">The pulse of your operations, right now.</p>
        </div>
        <Link href="/incidents/declare" className="btn btn-danger">Declare Incident</Link>
      </header>

      {/* stat tiles */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-dim text-xs font-medium uppercase tracking-wide">Open incidents</p>
          <p className={`text-3xl font-bold mt-1 ${openIncidents.length ? "text-red-400" : "text-green-400"}`}>
            {openIncidents.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-dim text-xs font-medium uppercase tracking-wide">MTTA · 30d</p>
          <p className="text-3xl font-bold mt-1">{fmtMinutes(mtta)}</p>
        </div>
        <div className="card p-4">
          <p className="text-dim text-xs font-medium uppercase tracking-wide">MTTR · 30d</p>
          <p className="text-3xl font-bold mt-1">{fmtMinutes(mttr)}</p>
        </div>
        <div className="card p-4">
          <p className="text-dim text-xs font-medium uppercase tracking-wide">Resolved · 30d</p>
          <p className="text-3xl font-bold mt-1">{resolved30d.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* open incidents */}
        <div className="col-span-2 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-3">Active incidents</h2>
            {openIncidents.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-green-400 font-semibold text-lg">All quiet 🎉</p>
                <p className="text-dim text-sm mt-1">No active incidents. Go build something.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openIncidents.map((inc) => {
                  const commander = inc.roles.find((r) => r.role === "commander")?.user;
                  return (
                    <Link key={inc.id} href={`/incidents/${inc.id}`} className="card p-4 flex items-center gap-4 hover:border-accent/60 transition-colors block">
                      <SeverityBadge severity={inc.severity} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          <span className="text-dim font-mono text-sm mr-2">INC-{inc.number}</span>
                          {inc.title}
                        </p>
                        <p className="text-dim text-sm mt-0.5 flex items-center gap-2">
                          {inc.service?.name ?? "No service"} · declared <TimeAgo date={inc.declaredAt} />
                        </p>
                      </div>
                      {commander && (
                        <span className="flex items-center gap-2 text-sm text-dim">
                          <Avatar name={commander.name} color={commander.avatarColor} size={24} />
                          IC
                        </span>
                      )}
                      <StatusBadge status={inc.status} />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-3">Recent activity</h2>
            <div className="card divide-y divide-line">
              {recentEvents.map((ev) => (
                <div key={ev.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  {ev.user ? (
                    <Avatar name={ev.user.name} color={ev.user.avatarColor} size={22} />
                  ) : (
                    <span className="w-[22px] h-[22px] rounded-full bg-elevated flex items-center justify-center text-[10px]">⚙️</span>
                  )}
                  <span className="flex-1 min-w-0 truncate text-ink/90">{ev.message}</span>
                  <Link href={`/incidents/${ev.incidentId}`} className="text-dim font-mono text-xs hover:text-accent shrink-0">
                    INC-{ev.incident.number}
                  </Link>
                  <span className="text-dim/70 text-xs shrink-0 w-16 text-right">
                    <TimeAgo date={ev.createdAt} />
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* right rail */}
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-3">On call now</h2>
            <div className="card divide-y divide-line">
              {onCallNow.map(({ schedule, user }) => (
                <div key={schedule.id} className="px-4 py-3 flex items-center gap-3">
                  {user ? (
                    <>
                      <Avatar name={user.name} color={user.avatarColor} size={32} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-dim text-xs truncate">{schedule.name}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-dim text-sm">No one on call · {schedule.name}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-3">Service health</h2>
            <div className="card divide-y divide-line">
              {services.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{s.name}</span>
                  <ServiceStatusBadge status={s.status} />
                </div>
              ))}
            </div>
            {degraded.length > 0 && (
              <p className="text-xs text-dim mt-2">
                {degraded.length} service{degraded.length > 1 ? "s" : ""} affected —{" "}
                <Link href="/status" className="text-accent hover:underline">view status page</Link>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
