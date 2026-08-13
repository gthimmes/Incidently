"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TimeAgo } from "@/components/ui";

interface DeliveryRow {
  id: string;
  event: string;
  status: string;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
}

interface HookRow {
  id: string;
  name: string;
  url: string;
  events: string; // JSON array
  active: boolean;
  createdAt: string;
  deliveries: DeliveryRow[];
  deliveryCount: number;
}

const EVENT_OPTIONS = [
  "incident.declared",
  "incident.status_changed",
  "incident.resolved",
  "incident.update_published",
];

export default function WebhooksPanel({ hooks }: { hooks: HookRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [allEvents, setAllEvents] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ name: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        url: url.trim(),
        events: allEvents ? ["*"] : picked,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "failed to create webhook");
      setBusy(false);
      return;
    }
    setFresh({ name: data.name, secret: data.secret });
    setName("");
    setUrl("");
    setCreating(false);
    router.refresh();
    setBusy(false);
  }

  async function patch(id: string, active: boolean) {
    setBusy(true);
    await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    router.refresh();
    setBusy(false);
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  async function sendTest(id: string) {
    setBusy(true);
    await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  async function redeliver(deliveryId: string) {
    setBusy(true);
    await fetch(`/api/webhooks/deliveries/${deliveryId}`, { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📡</span>
        <div>
          <h2 className="font-semibold">Outbound webhooks</h2>
          <p className="text-dim text-sm">
            Push incident events to your systems — HMAC-SHA256 signed, every delivery logged.
          </p>
        </div>
        {!creating && (
          <button className="btn btn-primary ml-auto" onClick={() => setCreating(true)}>
            + Add webhook
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="space-y-2 animate-in">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Name, e.g. ops-event-bus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              className="input flex-[2]"
              placeholder="https://example.com/hooks/incidently"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={allEvents} onChange={(e) => setAllEvents(e.target.checked)} />
              All events
            </label>
            {!allEvents &&
              EVENT_OPTIONS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 cursor-pointer font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={picked.includes(ev)}
                    onChange={(e) =>
                      setPicked(e.target.checked ? [...picked, ev] : picked.filter((p) => p !== ev))
                    }
                  />
                  {ev}
                </label>
              ))}
            <span className="ml-auto flex gap-2">
              <button
                className="btn btn-primary"
                disabled={busy || !name.trim() || !url.trim() || (!allEvents && picked.length === 0)}
              >
                Add
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </span>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      {fresh && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-4 space-y-2 animate-in">
          <p className="text-sm font-semibold text-green-400">
            Webhook &quot;{fresh.name}&quot; added — copy the signing secret now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs bg-panel border border-line rounded px-2 py-1.5 flex-1 break-all">
              {fresh.secret}
            </code>
            <button
              className="btn btn-ghost !py-1.5 shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(fresh.secret).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button
              className="btn btn-ghost !py-1.5 shrink-0"
              onClick={() => {
                setFresh(null);
                setCopied(false);
              }}
            >
              Done
            </button>
          </div>
          <p className="text-xs text-dim">
            Verify deliveries: <code className="font-mono">X-Incidently-Signature = sha256=HMAC_SHA256(secret, raw_body)</code>
          </p>
        </div>
      )}

      {hooks.map((h) => {
        let events: string[] = [];
        try { events = JSON.parse(h.events); } catch { /* legacy */ }
        return (
          <div key={h.id} data-testid={`hook-${h.name}`} className="rounded-lg border border-line bg-elevated/40 p-3.5 space-y-2.5">
            <div className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${h.active ? "bg-green-400" : "bg-slate-500"}`}
                title={h.active ? "Active" : "Paused"}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-xs text-dim font-mono truncate">
                  {h.url} · {events.includes("*") ? "all events" : events.join(", ")}
                </p>
              </div>
              <button className="btn btn-ghost !py-1 !px-2.5 !text-xs" disabled={busy} onClick={() => sendTest(h.id)}>
                Send test
              </button>
              <button
                className="btn btn-ghost !py-1 !px-2.5 !text-xs"
                disabled={busy}
                onClick={() => patch(h.id, !h.active)}
              >
                {h.active ? "Pause" : "Resume"}
              </button>
              <button
                className="btn btn-ghost !py-1 !px-2.5 !text-xs !text-red-400"
                disabled={busy}
                onClick={() => remove(h.id)}
              >
                Delete
              </button>
            </div>
            {h.deliveries.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-dim uppercase tracking-wide">
                  Recent deliveries ({h.deliveryCount} total)
                </p>
                {h.deliveries.map((d) => (
                  <div key={d.id} className="flex items-center gap-2.5 text-xs font-mono">
                    <span className={d.status === "success" ? "text-green-400" : "text-red-400"}>
                      {d.status === "success" ? "✓" : "✗"}
                    </span>
                    <span className="flex-1 truncate">{d.event}</span>
                    <span className="text-dim">
                      {d.statusCode ?? "—"} · {d.durationMs != null ? `${d.durationMs}ms` : "—"} ·{" "}
                      <TimeAgo date={d.createdAt} />
                    </span>
                    <button
                      className="text-accent hover:underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => redeliver(d.id)}
                    >
                      Redeliver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
