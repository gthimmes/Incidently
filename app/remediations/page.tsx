import Link from "next/link";
import { prisma } from "@/lib/db";
import { Avatar, SeverityBadge } from "@/components/ui";
import { ACTION_ITEM_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const COLUMNS = ["open", "in_progress", "done"] as const;

export default async function RemediationsPage() {
  const items = await prisma.actionItem.findMany({
    include: { incident: true, assignee: true, jiraLinks: true },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  const overdue = items.filter(
    (i) => i.dueAt && i.dueAt < new Date() && i.status !== "done" && i.status !== "wont_do"
  ).length;

  return (
    <div className="space-y-5 animate-in">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Remediations</h1>
          <p className="text-dim text-sm mt-0.5">
            Every follow-up from every incident, tracked to done. Nothing falls through the cracks.
          </p>
        </div>
        {overdue > 0 && (
          <span className="text-sm text-red-400 font-medium">{overdue} overdue</span>
        )}
      </header>

      <div className="grid grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.status === col);
          const meta = ACTION_ITEM_STATUSES[col];
          return (
            <div key={col} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="text-xs text-dim bg-elevated rounded-full px-2 py-0.5">{colItems.length}</span>
              </div>
              <div className="space-y-3 min-h-32">
                {colItems.map((item) => {
                  const isOverdue = item.dueAt && item.dueAt < new Date() && col !== "done";
                  return (
                    <div key={item.id} className="card p-3.5 space-y-2.5">
                      <p className={`text-sm font-medium leading-snug ${col === "done" ? "text-dim" : ""}`}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <SeverityBadge severity={item.incident.severity} />
                        <Link href={`/incidents/${item.incidentId}`} className="font-mono text-dim hover:text-accent">
                          INC-{item.incident.number}
                        </Link>
                        {item.jiraLinks.map((j) => (
                          <a key={j.id} href={j.issueUrl} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">
                            {j.issueKey}
                          </a>
                        ))}
                        <span
                          className={`ml-auto px-1.5 py-0.5 rounded font-medium ${
                            item.priority === "high" ? "bg-red-500/15 text-red-400" : item.priority === "medium" ? "bg-yellow-500/15 text-yellow-400" : "bg-slate-500/15 text-slate-400"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-dim">
                        {item.assignee ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar name={item.assignee.name} color={item.assignee.avatarColor} size={18} />
                            {item.assignee.name}
                          </span>
                        ) : (
                          <span className="text-dim/60">Unassigned</span>
                        )}
                        {item.dueAt && (
                          <span className={isOverdue ? "text-red-400 font-medium" : ""} suppressHydrationWarning>
                            due {item.dueAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {colItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-line p-6 text-center text-xs text-dim/60">
                    Nothing here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
