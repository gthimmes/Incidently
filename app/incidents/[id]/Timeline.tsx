"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, TimeAgo } from "@/components/ui";

const KIND_ICONS: Record<string, { icon: string; color: string }> = {
  declared: { icon: "🚨", color: "#ef4444" },
  status_change: { icon: "→", color: "#3b82f6" },
  severity_change: { icon: "⚠", color: "#f97316" },
  role_assigned: { icon: "👤", color: "#8b5cf6" },
  note: { icon: "✎", color: "#94a3b8" },
  page_sent: { icon: "📟", color: "#f97316" },
  page_acked: { icon: "✓", color: "#22c55e" },
  escalated: { icon: "⚡", color: "#eab308" },
  update_published: { icon: "📣", color: "#06b6d4" },
  resolved: { icon: "✅", color: "#22c55e" },
  jira_linked: { icon: "🔗", color: "#3b82f6" },
  action_item: { icon: "☑", color: "#8b5cf6" },
};

interface Ev {
  id: string;
  kind: string;
  message: string;
  createdAt: Date | string;
  user: { name: string; avatarColor: string } | null;
}

export default function Timeline({
  incidentId,
  events,
  disabled,
}: {
  incidentId: string;
  events: Ev[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    await fetch(`/api/incidents/${incidentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: note.trim() }),
    });
    setNote("");
    router.refresh();
    setBusy(false);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-3">Timeline</h2>

      {!disabled && (
        <form onSubmit={addNote} className="flex gap-2 mb-4">
          <input
            className="input"
            placeholder="Add a note to the timeline… (what did you just learn or do?)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn-primary shrink-0" disabled={busy || !note.trim()}>Add note</button>
        </form>
      )}

      <div className="card">
        <ol className="relative">
          {events.map((ev, i) => {
            const meta = KIND_ICONS[ev.kind] ?? KIND_ICONS.note;
            return (
              <li key={ev.id} className={`flex gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                  style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}44` }}
                >
                  {meta.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink/90 leading-snug">{ev.message}</p>
                  <p className="text-xs text-dim mt-1 flex items-center gap-2">
                    {ev.user && (
                      <>
                        <Avatar name={ev.user.name} color={ev.user.avatarColor} size={16} />
                        {ev.user.name}
                        <span>·</span>
                      </>
                    )}
                    <TimeAgo date={ev.createdAt} />
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
