import Link from "next/link";
import { prisma } from "@/lib/db";
import { SeverityBadge, PmStatusBadge, TimeAgo, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PostmortemsPage() {
  const postmortems = await prisma.postmortem.findMany({
    include: { incident: { include: { service: true, actionItems: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5 animate-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Postmortems</h1>
        <p className="text-dim text-sm mt-0.5">
          Blameless learning from every incident. SEV1/SEV2 postmortems are created automatically on resolve.
        </p>
      </header>

      {postmortems.length === 0 ? (
        <EmptyState title="No postmortems yet" subtitle="Resolve a SEV1/SEV2 incident and a draft will appear here." />
      ) : (
        <div className="space-y-3">
          {postmortems.map((pm) => {
            const openActions = pm.incident.actionItems.filter((a) => a.status !== "done" && a.status !== "wont_do").length;
            return (
              <Link key={pm.id} href={`/postmortems/${pm.id}`} className="card p-4 flex items-center gap-4 hover:border-accent/60 transition-colors block">
                <SeverityBadge severity={pm.incident.severity} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    <span className="text-dim font-mono text-sm mr-2">INC-{pm.incident.number}</span>
                    {pm.incident.title}
                  </p>
                  <p className="text-dim text-sm mt-0.5">
                    {pm.incident.service?.name ?? "No service"} · <TimeAgo date={pm.createdAt} />
                    {openActions > 0 && (
                      <span className="ml-2 text-yellow-400">{openActions} open action item{openActions > 1 ? "s" : ""}</span>
                    )}
                  </p>
                </div>
                <PmStatusBadge status={pm.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
