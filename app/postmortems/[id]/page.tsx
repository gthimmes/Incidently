import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SeverityBadge, Duration } from "@/components/ui";
import PostmortemEditor from "./PostmortemEditor";

export const dynamic = "force-dynamic";

export default async function PostmortemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pm = await prisma.postmortem.findUnique({
    where: { id },
    include: {
      incident: {
        include: {
          service: true,
          events: { orderBy: { createdAt: "asc" }, include: { user: true } },
          actionItems: { include: { assignee: true, jiraLinks: true } },
        },
      },
    },
  });
  if (!pm) notFound();
  const inc = pm.incident;

  return (
    <div className="space-y-6 animate-in max-w-4xl">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-dim">
          <Link href="/postmortems" className="hover:text-accent">Postmortems</Link>
          <span>/</span>
          <span className="font-mono">INC-{inc.number}</span>
        </div>
        <div className="flex items-center gap-3">
          <SeverityBadge severity={inc.severity} size="lg" />
          <h1 className="text-2xl font-bold tracking-tight">{inc.title}</h1>
        </div>
        <p className="text-dim text-sm">
          {inc.service?.name ?? "No service"} · duration <Duration from={inc.declaredAt} to={inc.resolvedAt} /> ·{" "}
          <Link href={`/incidents/${inc.id}`} className="text-accent hover:underline">view incident →</Link>
        </p>
      </header>

      <PostmortemEditor
        incidentId={inc.id}
        pm={{
          id: pm.id,
          status: pm.status,
          summary: pm.summary ?? "",
          impact: pm.impact ?? "",
          rootCause: pm.rootCause ?? "",
          timelineNotes: pm.timelineNotes ?? "",
          whatWentWell: pm.whatWentWell ?? "",
          whatWentPoorly: pm.whatWentPoorly ?? "",
          whereWeGotLucky: pm.whereWeGotLucky ?? "",
        }}
        timeline={inc.events.map((e) => ({
          id: e.id,
          message: e.message,
          at: e.createdAt.toISOString(),
          who: e.user?.name ?? null,
        }))}
        actionItems={inc.actionItems.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          assignee: a.assignee?.name ?? null,
          jira: a.jiraLinks[0]?.issueKey ?? null,
        }))}
      />
    </div>
  );
}
