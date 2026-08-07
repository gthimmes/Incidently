"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INCIDENT_STATUSES, STATUS_ORDER, SEVERITIES } from "@/lib/constants";

export default function IncidentControls({
  incident,
}: {
  incident: { id: string; status: string; severity: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const resolved = incident.status === "resolved";

  async function patch(body: Record<string, string>) {
    setBusy(true);
    await fetch(`/api/incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
    setBusy(false);
  }

  async function escalate() {
    setBusy(true);
    const res = await fetch(`/api/incidents/${incident.id}/escalate`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Escalation failed");
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="card p-4 flex items-center gap-6 flex-wrap">
      {/* status stepper */}
      <div className="flex items-center">
        {STATUS_ORDER.map((key, i) => {
          const st = INCIDENT_STATUSES[key];
          const currentIdx = STATUS_ORDER.indexOf(incident.status as typeof STATUS_ORDER[number]);
          const isCurrent = key === incident.status;
          const isPast = i < currentIdx;
          return (
            <div key={key} className="flex items-center">
              {i > 0 && <div className={`w-6 h-px ${isPast || isCurrent ? "bg-accent" : "bg-line"}`} />}
              <button
                disabled={busy || resolved || isCurrent}
                onClick={() => patch({ status: key })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:cursor-default ${
                  isCurrent
                    ? "text-white shadow-md"
                    : isPast
                      ? "text-dim"
                      : "text-dim hover:text-ink border border-line hover:border-[#35496b] cursor-pointer"
                }`}
                style={isCurrent ? { background: st.color } : undefined}
                title={st.description}
              >
                {st.label}
              </button>
            </div>
          );
        })}
      </div>

      <div className="h-6 w-px bg-line" />

      {/* severity selector */}
      <label className="flex items-center gap-2 text-sm text-dim">
        Severity
        <select
          className="input !w-auto !py-1"
          value={incident.severity}
          disabled={busy || resolved}
          onChange={(e) => patch({ severity: e.target.value })}
        >
          {Object.entries(SEVERITIES).map(([key, sev]) => (
            <option key={key} value={key}>{sev.label} — {sev.name}</option>
          ))}
        </select>
      </label>

      <div className="flex-1" />

      {!resolved && (
        <>
          <button className="btn btn-ghost" onClick={escalate} disabled={busy}>
            ⚡ Escalate
          </button>
          <button className="btn btn-success" onClick={() => patch({ status: "resolved" })} disabled={busy}>
            ✓ Resolve
          </button>
        </>
      )}
      {resolved && <span className="text-green-400 text-sm font-medium">Resolved — nice work.</span>}
    </div>
  );
}
