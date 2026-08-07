"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionStatusBadge } from "@/components/ui";

interface Item {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: { id: string; name: string } | null;
  jiraLinks: { issueKey: string; issueUrl: string }[];
}

export default function ActionItemsPanel({
  incidentId,
  items,
  users,
}: {
  incidentId: string;
  items: Item[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await fetch(`/api/incidents/${incidentId}/action-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), assigneeId: assigneeId || undefined }),
    });
    setTitle("");
    setAssigneeId("");
    setAdding(false);
    router.refresh();
    setBusy(false);
  }

  async function cycle(item: Item) {
    const next = item.status === "open" ? "in_progress" : item.status === "in_progress" ? "done" : "open";
    setBusy(true);
    await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
    setBusy(false);
  }

  async function pushToJira(item: Item) {
    setBusy(true);
    const res = await fetch(`/api/action-items/${item.id}/jira`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Jira push failed");
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-dim uppercase tracking-wide">Action items</h3>
        {!adding && (
          <button className="text-accent text-xs hover:underline" onClick={() => setAdding(true)}>+ Add</button>
        )}
      </div>

      {adding && (
        <form onSubmit={add} className="space-y-2 mb-3">
          <input
            className="input !text-xs"
            placeholder="What needs to happen?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <select className="input !text-xs flex-1" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button className="btn btn-primary !py-1 !px-2.5 !text-xs" disabled={busy || !title.trim()}>Add</button>
          </div>
        </form>
      )}

      {items.length === 0 && !adding ? (
        <p className="text-xs text-dim/70">No action items yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex items-start gap-2">
                <button
                  onClick={() => cycle(item)}
                  disabled={busy}
                  title="Click to cycle status"
                  className="mt-0.5 cursor-pointer"
                >
                  <ActionStatusBadge status={item.status} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`leading-snug ${item.status === "done" ? "line-through text-dim" : ""}`}>{item.title}</p>
                  <p className="text-[11px] text-dim mt-0.5 flex items-center gap-2 flex-wrap">
                    {item.assignee && <span>{item.assignee.name}</span>}
                    {item.jiraLinks.map((j) => (
                      <a key={j.issueKey} href={j.issueUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline font-mono">
                        {j.issueKey}
                      </a>
                    ))}
                    {item.jiraLinks.length === 0 && (
                      <button className="text-accent/80 hover:text-accent hover:underline cursor-pointer" disabled={busy} onClick={() => pushToJira(item)}>
                        → Push to Jira
                      </button>
                    )}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
