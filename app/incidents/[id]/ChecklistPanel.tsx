"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ChecklistRow {
  id: string;
  order: number;
  text: string;
  done: boolean;
  doneBy: { name: string } | null;
}

export default function ChecklistPanel({
  items,
  disabled,
}: {
  items: ChecklistRow[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(item: ChecklistRow) {
    if (disabled || busy) return;
    setBusy(item.id);
    await fetch(`/api/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    router.refresh();
    setBusy(null);
  }

  if (items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-dim uppercase tracking-wide">Response checklist</h3>
        <span className="text-xs font-mono text-dim">{done}/{items.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-elevated overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#3987e5" }}
        />
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              className={`w-full text-left flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                disabled ? "cursor-default" : "hover:bg-elevated"
              }`}
              onClick={() => toggle(item)}
              disabled={disabled || busy === item.id}
            >
              <span
                className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${
                  item.done ? "bg-green-500/20 border-green-500/60 text-green-400" : "border-line text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="min-w-0">
                <span className={`text-sm block ${item.done ? "line-through text-dim" : ""}`}>{item.text}</span>
                {item.done && item.doneBy && (
                  <span className="text-[11px] text-dim">by {item.doneBy.name}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
