"use client";

import { useState } from "react";

interface Cfg {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  mockMode: boolean;
}

export default function JiraSettings({ initial }: { initial: Cfg }) {
  const [cfg, setCfg] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function save(test: boolean) {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/settings/jira", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cfg, test }),
    });
    const data = await res.json();
    setResult(data);
    setBusy(false);
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔷</span>
        <div>
          <h2 className="font-semibold">Jira Cloud</h2>
          <p className="text-dim text-sm">Push remediation items to Jira and keep them linked.</p>
        </div>
        <span
          className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
            cfg.mockMode ? "bg-yellow-500/15 text-yellow-400" : "bg-green-500/15 text-green-400"
          }`}
        >
          {cfg.mockMode ? "Mock mode" : "Live"}
        </span>
      </div>

      <label className="flex items-center gap-2.5 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={cfg.mockMode}
          onChange={(e) => setCfg({ ...cfg, mockMode: e.target.checked })}
          className="w-4 h-4 accent-indigo-500"
        />
        <span>
          <span className="font-medium">Mock mode</span>
          <span className="text-dim"> — issues get realistic keys (OPS-123) without touching a real Jira site. Perfect for demos.</span>
        </span>
      </label>

      <div className={`grid grid-cols-2 gap-4 ${cfg.mockMode ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1.5">Site URL</label>
          <input
            className="input"
            placeholder="https://yourcompany.atlassian.net"
            value={cfg.baseUrl}
            onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            className="input"
            placeholder="you@company.com"
            value={cfg.email}
            onChange={(e) => setCfg({ ...cfg, email: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">API token</label>
          <input
            className="input"
            type="password"
            placeholder="from id.atlassian.com/manage-profile/security/api-tokens"
            value={cfg.apiToken}
            onChange={(e) => setCfg({ ...cfg, apiToken: e.target.value })}
          />
        </div>
      </div>
      <div className="w-40">
        <label className="block text-sm font-medium mb-1.5">Project key</label>
        <input
          className="input"
          placeholder="OPS"
          value={cfg.projectKey}
          onChange={(e) => setCfg({ ...cfg, projectKey: e.target.value.toUpperCase() })}
        />
      </div>

      {result && (
        <p className={`text-sm ${result.ok ? "text-green-400" : "text-red-400"}`}>{result.message}</p>
      )}

      <div className="flex gap-3 justify-end">
        <button className="btn btn-ghost" onClick={() => save(true)} disabled={busy}>Test connection</button>
        <button className="btn btn-primary" onClick={() => save(false)} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
