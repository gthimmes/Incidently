"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TimeAgo } from "@/components/ui";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPanel({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [freshToken, setFreshToken] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/apikeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setFreshToken({ name: data.name, token: data.token });
    setName("");
    setCreating(false);
    router.refresh();
    setBusy(false);
  }

  async function revoke(id: string) {
    setBusy(true);
    await fetch(`/api/apikeys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    router.refresh();
    setBusy(false);
  }

  const curl = `curl http://localhost:3000/api/v1/incidents?status=open \\
  -H "Authorization: Bearer <your-key>"`;

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔑</span>
        <div>
          <h2 className="font-semibold">API keys</h2>
          <p className="text-dim text-sm">
            Programmatic access to <code className="font-mono bg-elevated px-1 rounded">/api/v1</code> —
            incidents, services (with SLO burn), and on-call.
          </p>
        </div>
        {!creating && (
          <button className="btn btn-primary ml-auto" onClick={() => setCreating(true)}>
            + Create key
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="flex gap-2 animate-in">
          <input
            className="input"
            placeholder="Key name, e.g. terraform, statusbot, grafana-annotations"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary shrink-0" disabled={busy || !name.trim()}>Create</button>
          <button type="button" className="btn btn-ghost shrink-0" onClick={() => setCreating(false)}>Cancel</button>
        </form>
      )}

      {freshToken && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-4 space-y-2 animate-in">
          <p className="text-sm font-semibold text-green-400">
            Key &quot;{freshToken.name}&quot; created — copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs bg-panel border border-line rounded px-2 py-1.5 flex-1 break-all">
              {freshToken.token}
            </code>
            <button
              className="btn btn-ghost !py-1.5 shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(freshToken.token).catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button className="btn btn-ghost !py-1.5 shrink-0" onClick={() => { setFreshToken(null); setCopied(false); }}>
              Done
            </button>
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <div className="divide-y divide-line">
          {keys.map((k) => (
            <div key={k.id} className="py-2.5 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${k.revoked ? "line-through text-dim" : ""}`}>{k.name}</p>
                <p className="text-xs text-dim font-mono">
                  {k.prefix}… · created <TimeAgo date={k.createdAt} />
                  {k.lastUsedAt && <> · last used <TimeAgo date={k.lastUsedAt} /></>}
                </p>
              </div>
              {k.revoked ? (
                <span className="text-xs text-red-400/80">Revoked</span>
              ) : (
                <button className="btn btn-ghost !py-1 !px-2.5 !text-xs" disabled={busy} onClick={() => revoke(k.id)}>
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <details className="text-xs text-dim">
        <summary className="cursor-pointer hover:text-ink">API reference</summary>
        <div className="mt-2 space-y-1.5 font-mono bg-elevated rounded-lg p-3">
          <p>GET  /api/v1/incidents?status=open|resolved&amp;limit=N</p>
          <p>POST /api/v1/incidents {"{title, severity, service?, summary?}"} — declares + pages on-call</p>
          <p>GET  /api/v1/incidents/:number — full detail with timeline</p>
          <p>GET  /api/v1/services — catalog + effective status + SLO burn</p>
          <p>GET  /api/v1/oncall — who is on call per schedule</p>
        </div>
        <pre className="mt-2 font-mono bg-elevated rounded-lg p-3 overflow-x-auto">{curl}</pre>
      </details>
    </section>
  );
}
