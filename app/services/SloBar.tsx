"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TARGETS = ["99", "99.5", "99.9", "99.95"];

export default function SloBar({
  serviceId,
  slo,
}: {
  serviceId: string;
  slo: {
    targetPct: number;
    windowDays: number;
    burnPct: number;
    burnedMinutes: number;
    budgetMinutes: number;
    remainingMinutes: number;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setTarget(targetPct: string) {
    setBusy(true);
    await fetch(`/api/services/${serviceId}/slo`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPct: Number(targetPct) }),
    });
    router.refresh();
    setBusy(false);
  }

  if (!slo) {
    return (
      <div className="flex items-center gap-2 text-xs text-dim pt-2 border-t border-line">
        <span>No SLO set</span>
        <select
          className="input !w-auto !py-0.5 !text-xs"
          defaultValue=""
          disabled={busy}
          onChange={(e) => e.target.value && setTarget(e.target.value)}
        >
          <option value="">Set target…</option>
          {TARGETS.map((t) => (
            <option key={t} value={t}>{t}%</option>
          ))}
        </select>
      </div>
    );
  }

  const pct = Math.min(slo.burnPct, 100);
  const color = slo.burnPct >= 100 ? "#ef4444" : slo.burnPct >= 70 ? "#f97316" : slo.burnPct >= 40 ? "#eab308" : "#22c55e";

  return (
    <div className="pt-2 border-t border-line space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-dim">
          SLO {slo.targetPct}% · {slo.windowDays}d error budget
        </span>
        <span className="font-medium" style={{ color }}>
          {Math.round(slo.burnPct)}% burned
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-elevated overflow-hidden"
        title={`${Math.round(slo.burnedMinutes)}m of ${Math.round(slo.budgetMinutes)}m budget used · ${Math.round(slo.remainingMinutes)}m remaining`}
      >
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-dim">
        <span>{Math.round(slo.remainingMinutes)}m of budget left</span>
        <select
          className="bg-transparent text-dim hover:text-ink cursor-pointer outline-none"
          value={String(slo.targetPct)}
          disabled={busy}
          onChange={(e) => setTarget(e.target.value)}
        >
          {TARGETS.map((t) => (
            <option key={t} value={t}>target {t}%</option>
          ))}
        </select>
      </div>
    </div>
  );
}
