"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEVERITIES } from "@/lib/constants";

interface Props {
  services: { id: string; name: string; tier: number }[];
  users: { id: string; name: string }[];
}

export default function DeclareForm({ services, users }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("sev2");
  const [serviceId, setServiceId] = useState("");
  const [actorId, setActorId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        summary: summary.trim() || undefined,
        severity,
        serviceId: serviceId || undefined,
        actorId: actorId || undefined,
      }),
    });
    if (!res.ok) {
      setError("Failed to declare incident");
      setSubmitting(false);
      return;
    }
    const incident = await res.json();
    router.push(`/incidents/${incident.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">What&apos;s happening? *</label>
        <input
          className="input"
          placeholder="e.g. Elevated error rates on checkout API"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Summary</label>
        <textarea
          className="input min-h-20"
          placeholder="What do we know so far? Customer impact? First signals?"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Severity *</label>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(SEVERITIES).map(([key, sev]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSeverity(key)}
              className={`rounded-lg border p-3 text-left transition-all ${
                severity === key ? "bg-elevated" : "border-line hover:border-[#35496b]"
              }`}
              style={severity === key ? { borderColor: sev.color, boxShadow: `0 0 0 1px ${sev.color}` } : undefined}
            >
              <span className="font-bold text-sm" style={{ color: sev.color }}>{sev.label}</span>
              <span className="block text-[11px] text-dim mt-0.5 leading-tight">{sev.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Affected service</label>
          <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">— none / unknown —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} (Tier {s.tier})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Declared by</label>
          <select className="input" value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="">— default (admin) —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-elevated border border-line p-3 text-xs text-dim leading-relaxed">
        <span className="font-semibold text-ink">On declare:</span> level 1 of the service&apos;s escalation
        policy is paged instantly (SMS · voice · email · push), a dedicated channel is opened, and the
        status page is updated for SEV1/SEV2.
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-danger" disabled={submitting || !title.trim()}>
          {submitting ? "Declaring…" : "Declare incident"}
        </button>
      </div>
    </form>
  );
}
