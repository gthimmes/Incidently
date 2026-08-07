"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionStatusBadge, PmStatusBadge } from "@/components/ui";

interface PmData {
  id: string;
  status: string;
  summary: string;
  impact: string;
  rootCause: string;
  timelineNotes: string;
  whatWentWell: string;
  whatWentPoorly: string;
  whereWeGotLucky: string;
}

const SECTIONS: { key: keyof Omit<PmData, "id" | "status">; label: string; hint: string }[] = [
  { key: "summary", label: "Summary", hint: "One paragraph a new engineer could understand: what broke, for how long, and what fixed it." },
  { key: "impact", label: "Impact", hint: "Who felt this and how badly? Customers affected, requests failed, revenue at risk." },
  { key: "rootCause", label: "Root cause", hint: "The technical chain of events. Go past the trigger to the systemic cause — keep asking why." },
  { key: "timelineNotes", label: "Timeline notes", hint: "Anything the auto-captured timeline below misses: detection gaps, decision points." },
  { key: "whatWentWell", label: "What went well", hint: "Celebrate the response. Fast acks? Good runbooks? Clean comms?" },
  { key: "whatWentPoorly", label: "What went poorly", hint: "Blameless, but honest. Where did process or tooling fail us?" },
  { key: "whereWeGotLucky", label: "Where we got lucky", hint: "Near-misses matter — what would have made this worse?" },
];

export default function PostmortemEditor({
  incidentId,
  pm,
  timeline,
  actionItems,
}: {
  incidentId: string;
  pm: PmData;
  timeline: { id: string; message: string; at: string; who: string | null }[];
  actionItems: { id: string; title: string; status: string; assignee: string | null; jira: string | null }[];
}) {
  const router = useRouter();
  const [data, setData] = useState(pm);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save(extra: Partial<PmData> = {}) {
    setSaving(true);
    const payload = { ...data, ...extra };
    await fetch(`/api/incidents/${incidentId}/postmortem`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setData(payload);
    setSavedAt(new Date());
    router.refresh();
    setSaving(false);
  }

  const nextStatus = data.status === "draft" ? "in_review" : data.status === "in_review" ? "published" : null;
  const nextLabel = data.status === "draft" ? "Submit for review" : "Publish";

  return (
    <div className="space-y-6">
      <div className="card p-4 flex items-center gap-4">
        <PmStatusBadge status={data.status} />
        <span className="text-xs text-dim">
          {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Unsaved changes are kept locally until you save."}
        </span>
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={() => save()} disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </button>
        {nextStatus && (
          <button className="btn btn-primary" onClick={() => save({ status: nextStatus })} disabled={saving}>
            {nextLabel}
          </button>
        )}
      </div>

      {SECTIONS.map((s) => (
        <section key={s.key} className="card p-5">
          <h2 className="font-semibold mb-1">{s.label}</h2>
          <p className="text-xs text-dim mb-3">{s.hint}</p>
          <textarea
            className="input min-h-24 leading-relaxed"
            value={data[s.key]}
            onChange={(e) => setData({ ...data, [s.key]: e.target.value })}
            placeholder="Write it down while it's fresh…"
          />
        </section>
      ))}

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Remediation items</h2>
        {actionItems.length === 0 ? (
          <p className="text-sm text-dim">No action items yet — add them from the incident page.</p>
        ) : (
          <ul className="space-y-2">
            {actionItems.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <ActionStatusBadge status={a.status} />
                <span className={a.status === "done" ? "line-through text-dim" : ""}>{a.title}</span>
                <span className="text-xs text-dim ml-auto">
                  {a.assignee ?? "unassigned"}
                  {a.jira && <span className="font-mono text-accent ml-2">{a.jira}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Incident timeline <span className="text-dim text-xs font-normal">(auto-captured)</span></h2>
        <ol className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {timeline.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="text-dim font-mono text-xs shrink-0 w-36" suppressHydrationWarning>
                {new Date(e.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-ink/85">{e.message}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
