import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SeverityBadge, StatusBadge, TimeAgo, Duration } from "@/components/ui";
import { INCIDENT_ROLES } from "@/lib/constants";
import IncidentControls from "./IncidentControls";
import Timeline from "./Timeline";
import UpdatesPanel from "./UpdatesPanel";
import RolesPanel from "./RolesPanel";
import PagesPanel from "./PagesPanel";
import ActionItemsPanel from "./ActionItemsPanel";

export const dynamic = "force-dynamic";

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      service: true,
      roles: { include: { user: true } },
      events: { include: { user: true }, orderBy: { createdAt: "desc" } },
      statusUpdates: { include: { author: true }, orderBy: { createdAt: "desc" } },
      pages: { include: { user: true }, orderBy: { sentAt: "desc" } },
      actionItems: { include: { assignee: true, jiraLinks: true }, orderBy: { createdAt: "desc" } },
      postmortem: true,
      jiraLinks: true,
    },
  });
  if (!incident) notFound();

  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  const runbooks = incident.serviceId
    ? await prisma.runbook.findMany({
        where: { serviceId: incident.serviceId },
        select: { id: true, title: true },
      })
    : [];
  const resolved = incident.status === "resolved";

  return (
    <div className="space-y-6 animate-in">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-dim">
          <Link href="/incidents" className="hover:text-accent">Incidents</Link>
          <span>/</span>
          <span className="font-mono">INC-{incident.number}</span>
        </div>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <SeverityBadge severity={incident.severity} size="lg" />
            <h1 className="text-2xl font-bold tracking-tight truncate">{incident.title}</h1>
            <StatusBadge status={incident.status} size="lg" />
          </div>
        </div>
        {incident.summary && <p className="text-dim max-w-3xl">{incident.summary}</p>}
        <div className="flex items-center gap-5 text-sm text-dim flex-wrap">
          {incident.service && (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {incident.service.name}
            </span>
          )}
          <span>Declared <TimeAgo date={incident.declaredAt} /></span>
          <span>Duration: <Duration from={incident.declaredAt} to={incident.resolvedAt} /></span>
          {incident.slackChannel && (
            <span className="font-mono text-xs bg-elevated border border-line rounded px-2 py-0.5">{incident.slackChannel}</span>
          )}
          {incident.postmortem && (
            <Link href={`/postmortems/${incident.postmortem.id}`} className="text-accent hover:underline">
              View postmortem →
            </Link>
          )}
        </div>
      </header>

      <IncidentControls incident={{ id: incident.id, status: incident.status, severity: incident.severity }} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <UpdatesPanel incidentId={incident.id} updates={incident.statusUpdates} disabled={resolved} />
          <Timeline incidentId={incident.id} events={incident.events} disabled={resolved} />
        </div>
        <div className="space-y-6">
          <RolesPanel
            incidentId={incident.id}
            roles={incident.roles}
            users={users}
            roleDefs={INCIDENT_ROLES}
            disabled={resolved}
          />
          {runbooks.length > 0 && (
            <section className="card p-4">
              <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2">
                Runbooks for {incident.service?.name}
              </h3>
              <ul className="space-y-1.5">
                {runbooks.map((rb) => (
                  <li key={rb.id}>
                    <Link href={`/runbooks/${rb.id}`} className="text-sm text-accent hover:underline flex items-center gap-2">
                      <span>📘</span> {rb.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <PagesPanel pages={incident.pages} disabled={resolved} />
          <ActionItemsPanel incidentId={incident.id} items={incident.actionItems} users={users} />

          {/* key timestamps */}
          <section className="card p-4 space-y-2 text-sm">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2">Key timestamps</h3>
            {[
              ["Declared", incident.declaredAt],
              ["Acknowledged", incident.acknowledgedAt],
              ["Mitigated", incident.mitigatedAt],
              ["Resolved", incident.resolvedAt],
            ].map(([label, ts]) => (
              <div key={label as string} className="flex justify-between">
                <span className="text-dim">{label as string}</span>
                <span className="font-mono text-xs" suppressHydrationWarning>
                  {ts ? new Date(ts as Date).toLocaleString() : "—"}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
