import Link from "next/link";
import { prisma } from "@/lib/db";
import { TimeAgo, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RunbooksPage() {
  const runbooks = await prisma.runbook.findMany({
    include: { service: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-5 animate-in max-w-4xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runbooks</h1>
          <p className="text-dim text-sm mt-0.5">
            Operational knowledge, attached to services and surfaced automatically during incidents.
          </p>
        </div>
        <Link href="/runbooks/new" className="btn btn-primary">+ New runbook</Link>
      </header>

      {runbooks.length === 0 ? (
        <EmptyState title="No runbooks yet" subtitle="Write down what to do before you need it at 3am." />
      ) : (
        <div className="space-y-3">
          {runbooks.map((rb) => (
            <Link key={rb.id} href={`/runbooks/${rb.id}`} className="card p-4 flex items-center gap-4 hover:border-accent/60 transition-colors block">
              <span className="w-9 h-9 rounded-lg bg-elevated border border-line flex items-center justify-center text-base shrink-0">📘</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{rb.title}</p>
                <p className="text-dim text-sm mt-0.5">
                  {rb.service?.name ?? "General"} · updated <TimeAgo date={rb.updatedAt} />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
