"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, TimeAgo, StatusBadge } from "@/components/ui";

interface Update {
  id: string;
  body: string;
  status: string;
  createdAt: Date | string;
  author: { name: string; avatarColor: string };
}

export default function UpdatesPanel({
  incidentId,
  updates,
  disabled,
}: {
  incidentId: string;
  updates: Update[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    await fetch(`/api/incidents/${incidentId}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    setBody("");
    setComposing(false);
    router.refresh();
    setBusy(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wide">Status updates</h2>
        {!disabled && !composing && (
          <button className="btn btn-primary !py-1.5" onClick={() => setComposing(true)}>
            📣 Publish update
          </button>
        )}
      </div>

      {composing && (
        <form onSubmit={publish} className="card p-4 mb-4 space-y-3">
          <textarea
            className="input min-h-24"
            placeholder="What should stakeholders and customers know right now?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-dim">
            Published to the incident feed and the public status page.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost !py-1.5" onClick={() => setComposing(false)}>Cancel</button>
            <button className="btn btn-primary !py-1.5" disabled={busy || !body.trim()}>Publish</button>
          </div>
        </form>
      )}

      {updates.length === 0 && !composing ? (
        <div className="card p-5 text-sm text-dim text-center">
          No updates published yet.{!disabled && " Stakeholders are waiting to hear from you."}
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => (
            <div key={u.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Avatar name={u.author.name} color={u.author.avatarColor} size={22} />
                <span className="text-sm font-medium">{u.author.name}</span>
                <StatusBadge status={u.status} />
                <span className="text-xs text-dim ml-auto"><TimeAgo date={u.createdAt} /></span>
              </div>
              <p className="text-sm text-ink/90 leading-relaxed">{u.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
