"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TimeAgo } from "@/components/ui";

interface AlertRow {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string;
  count: number;
  lastSeenAt: string;
  service: { name: string; tier: number } | null;
  incident: { id: string; number: number } | null;
}

const SEV: Record<string, { label: string; color: string; icon: string }> = {
  critical: { label: "Critical", color: "#ef4444", icon: "🔴" },
  warning: { label: "Warning", color: "#eab308", icon: "🟡" },
  info: { label: "Info", color: "#3b82f6", icon: "🔵" },
};

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#f97316" },
  acked: { label: "Acked", color: "#3b82f6" },
  resolved: { label: "Resolved", color: "#64748b" },
};

export default function AlertsFeed({ alerts, token }: { alerts: AlertRow[]; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [lastAction, setLastAction] = useState("");

  async function patch(id: string, body: Record<string, string>) {
    setBusy(true);
    await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
    setBusy(false);
  }

  async function fireTest(kind: "warning" | "critical") {
    setBusy(true);
    const res = await fetch("/api/alerts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = await res.json();
    setLastAction(
      data.action === "incident_declared"
        ? "Critical alert → incident auto-declared and on-call paged."
        : data.action === "attached_to_incident"
          ? "Critical alert attached to the service's open incident."
          : data.action === "deduplicated"
            ? "Duplicate alert deduplicated — counter bumped."
            : "Alert created in the feed.",
    );
    router.refresh();
    setBusy(false);
  }

  const open = alerts.filter((a) => a.status !== "resolved");
  const resolved = alerts.filter((a) => a.status === "resolved");

  const curl = `curl -X POST http://localhost:3000/api/ingest \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Checkout error rate above 5%","severity":"critical","service":"payments","dedup_key":"checkout-5xx","source":"datadog"}'`;

  return (
    <div className="space-y-5 animate-in">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-dim text-sm mt-0.5">
            The front door for your monitoring. Critical alerts on tier-1 services become incidents automatically.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn btn-ghost" onClick={() => setShowSetup(!showSetup)}>
            {showSetup ? "Hide setup" : "Webhook setup"}
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => fireTest("warning")}>
            🟡 Test warning
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => fireTest("critical")}>
            🔴 Test critical
          </button>
        </div>
      </header>

      {lastAction && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm animate-in">
          ⚡ {lastAction}
        </div>
      )}

      {showSetup && (
        <div className="card p-4 space-y-3 animate-in">
          <h2 className="font-semibold text-sm">Point your monitoring at Incidently</h2>
          <p className="text-dim text-xs leading-relaxed">
            POST alerts to <code className="font-mono bg-elevated px-1 rounded">/api/ingest</code>.
            Fields: <code className="font-mono">title</code> (required),{" "}
            <code className="font-mono">severity</code> (critical | warning | info),{" "}
            <code className="font-mono">service</code> (slug), <code className="font-mono">dedup_key</code>{" "}
            (duplicate alerts bump a counter instead of flooding the feed),{" "}
            <code className="font-mono">status</code> (&quot;resolved&quot; auto-closes matching alerts).
          </p>
          <pre className="font-mono text-[11px] bg-elevated rounded-lg p-3 overflow-x-auto text-ink/85">{curl}</pre>
          <p className="text-dim text-xs">
            Promotion rules: critical + tier-1 service → SEV1 incident (pages on-call) · critical + tier-2/3 → SEV2 ·
            service already has an open incident → alert attaches to it · warning/info → triage here.
          </p>
        </div>
      )}

      <section className="space-y-2.5">
        {open.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-green-400 font-semibold">No open alerts</p>
            <p className="text-dim text-sm mt-1">Fire a test alert to see the pipeline in action.</p>
          </div>
        )}
        {open.map((a) => {
          const sev = SEV[a.severity] ?? SEV.info;
          const st = STATUS[a.status] ?? STATUS.open;
          return (
            <div key={a.id} className="card px-4 py-3 flex items-start gap-3">
              <span className="text-base mt-0.5">{sev.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.title}</span>
                  {a.count > 1 && (
                    <span className="text-xs font-mono bg-elevated border border-line rounded-full px-2 py-0.5" title="Deduplicated occurrences">
                      ×{a.count}
                    </span>
                  )}
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${st.color}18`, color: st.color }}>
                    {st.label}
                  </span>
                </div>
                {a.description && <p className="text-sm text-dim mt-0.5">{a.description}</p>}
                <p className="text-xs text-dim mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-mono bg-elevated rounded px-1.5 py-0.5">{a.source}</span>
                  {a.service && <span>{a.service.name} · Tier {a.service.tier}</span>}
                  <span>last seen <TimeAgo date={a.lastSeenAt} /></span>
                  {a.incident && (
                    <Link href={`/incidents/${a.incident.id}`} className="text-accent hover:underline font-mono">
                      → INC-{a.incident.number}
                    </Link>
                  )}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {!a.incident && (
                  <button
                    className="btn btn-primary !py-1 !px-2.5 !text-xs"
                    disabled={busy}
                    onClick={() => patch(a.id, { action: "promote" })}
                  >
                    Promote to incident
                  </button>
                )}
                {a.status === "open" && (
                  <button className="btn btn-ghost !py-1 !px-2.5 !text-xs" disabled={busy} onClick={() => patch(a.id, { status: "acked" })}>
                    Ack
                  </button>
                )}
                <button className="btn btn-ghost !py-1 !px-2.5 !text-xs" disabled={busy} onClick={() => patch(a.id, { status: "resolved" })}>
                  Resolve
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-dim uppercase tracking-wide mb-2">Recently resolved</h2>
          <div className="card divide-y divide-line">
            {resolved.slice(0, 10).map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 text-sm opacity-60">
                <span>{(SEV[a.severity] ?? SEV.info).icon}</span>
                <span className="flex-1 truncate">{a.title}</span>
                {a.count > 1 && <span className="text-xs font-mono">×{a.count}</span>}
                <span className="text-xs text-dim"><TimeAgo date={a.lastSeenAt} /></span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
