"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Window {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  active: boolean;
}

export default function MaintenancePanel({
  services,
  windows,
}: {
  services: { id: string; name: string }[];
  windows: Window[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, title, startsAt, endsAt }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to schedule");
      setBusy(false);
      return;
    }
    setOpen(false);
    setTitle("");
    setStartsAt("");
    setEndsAt("");
    router.refresh();
    setBusy(false);
  }

  async function cancel(id: string) {
    setBusy(true);
    await fetch(`/api/maintenance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Maintenance windows</h2>
          <p className="text-dim text-sm">
            Planned work shows on the status page ahead of time; active windows report as Maintenance.
          </p>
        </div>
        {!open && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            🔧 Schedule maintenance
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={schedule} className="grid grid-cols-2 gap-3 animate-in">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5">What&apos;s happening?</label>
            <input
              className="input"
              placeholder="e.g. Database engine upgrade"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5">Service</label>
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              <option value="">— pick a service —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Starts</label>
            <input type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Ends</label>
            <input type="datetime-local" className="input" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
          </div>
          {error && <p className="text-red-400 text-sm col-span-2">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !serviceId || !title.trim()}>
              {busy ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </form>
      )}

      {windows.length === 0 ? (
        <p className="text-sm text-dim/70">Nothing scheduled.</p>
      ) : (
        <ul className="divide-y divide-line">
          {windows.map((w) => (
            <li key={w.id} className="py-2.5 flex items-center gap-3 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${w.active ? "bg-blue-400 pulse-live" : "bg-slate-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {w.title}
                  {w.active && <span className="text-blue-400 text-xs ml-2">in progress</span>}
                </p>
                <p className="text-xs text-dim" suppressHydrationWarning>
                  {w.serviceName} · {new Date(w.startsAt).toLocaleString()} → {new Date(w.endsAt).toLocaleString()}
                </p>
              </div>
              <button className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={busy} onClick={() => cancel(w.id)}>
                Cancel window
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
