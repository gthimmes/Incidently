import { prisma } from "@/lib/db";
import { SERVICE_STATUSES, INCIDENT_STATUSES } from "@/lib/constants";
import { TimeAgo } from "@/components/ui";

export const dynamic = "force-dynamic";

// The public status page — what your customers would see at status.yourco.com
export default async function StatusPage() {
  const services = await prisma.service.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] });
  const openIncidents = await prisma.incident.findMany({
    where: { status: { not: "resolved" }, visibility: "public" },
    include: {
      service: true,
      statusUpdates: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { declaredAt: "desc" },
  });
  const recentResolved = await prisma.incident.findMany({
    where: { status: "resolved", visibility: "public", resolvedAt: { gte: new Date(Date.now() - 14 * 24 * 3600_000) } },
    include: { service: true },
    orderBy: { resolvedAt: "desc" },
    take: 5,
  });

  const allOperational = services.every((s) => s.status === "operational");
  const worstStatus = services.some((s) => s.status === "major_outage")
    ? "major_outage"
    : services.some((s) => s.status === "partial_outage")
      ? "partial_outage"
      : services.some((s) => s.status === "degraded")
        ? "degraded"
        : "operational";

  const banner = allOperational
    ? { text: "All systems operational", color: "#22c55e" }
    : { text: SERVICE_STATUSES[worstStatus as keyof typeof SERVICE_STATUSES].label, color: SERVICE_STATUSES[worstStatus as keyof typeof SERVICE_STATUSES].color };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in">
      <header className="text-center pt-4">
        <p className="text-dim text-xs uppercase tracking-widest mb-2">Public status page preview</p>
        <h1 className="text-3xl font-bold tracking-tight">Aiwyn System Status</h1>
      </header>

      <div
        className="rounded-xl p-5 text-center font-semibold text-lg"
        style={{ background: `${banner.color}15`, border: `1px solid ${banner.color}50`, color: banner.color }}
      >
        {banner.text}
      </div>

      {openIncidents.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-dim uppercase tracking-wide">Active incidents</h2>
          {openIncidents.map((inc) => {
            const st = INCIDENT_STATUSES[inc.status as keyof typeof INCIDENT_STATUSES];
            return (
              <div key={inc.id} className="card p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full pulse-live" style={{ background: st.color }} />
                    <h3 className="font-semibold">{inc.title}</h3>
                  </div>
                  <p className="text-dim text-sm mt-1">
                    {inc.service?.name} · <span style={{ color: st.color }}>{st.label}</span> · started <TimeAgo date={inc.declaredAt} />
                  </p>
                </div>
                <div className="space-y-3 border-l-2 border-line pl-4">
                  {inc.statusUpdates.map((u) => (
                    <div key={u.id}>
                      <p className="text-sm leading-relaxed">{u.body}</p>
                      <p className="text-xs text-dim mt-1"><TimeAgo date={u.createdAt} /></p>
                    </div>
                  ))}
                  {inc.statusUpdates.length === 0 && (
                    <p className="text-sm text-dim italic">Investigating — updates to follow.</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wide">Components</h2>
        <div className="card divide-y divide-line">
          {services.map((s) => {
            const st = SERVICE_STATUSES[s.status as keyof typeof SERVICE_STATUSES];
            return (
              <div key={s.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-dim mt-0.5">{s.description}</p>
                </div>
                <span className="text-sm font-medium flex items-center gap-2" style={{ color: st.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {recentResolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-dim uppercase tracking-wide">Past incidents · 14 days</h2>
          <div className="card divide-y divide-line">
            {recentResolved.map((inc) => (
              <div key={inc.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{inc.title}</p>
                  <p className="text-xs text-dim mt-0.5">{inc.service?.name}</p>
                </div>
                <span className="text-xs text-dim" suppressHydrationWarning>
                  resolved {inc.resolvedAt && <TimeAgo date={inc.resolvedAt} />}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-dim/60 pb-6">Powered by Incidently</p>
    </div>
  );
}
