"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, TimeAgo } from "@/components/ui";

interface PageRow {
  id: string;
  level: number;
  status: string;
  sentAt: Date | string;
  ackedAt: Date | string | null;
  user: { name: string; avatarColor: string };
}

const PAGE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Awaiting ack", color: "#f97316" },
  acknowledged: { label: "Acknowledged", color: "#22c55e" },
  timed_out: { label: "Timed out", color: "#ef4444" },
  resolved: { label: "Closed", color: "#64748b" },
};

export default function PagesPanel({
  incidentId: _incidentId,
  pages,
  disabled,
}: {
  incidentId: string;
  pages: PageRow[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function ack(pageId: string) {
    setBusy(true);
    await fetch(`/api/pages/${pageId}/ack`, { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  if (pages.length === 0) return null;

  return (
    <section className="card p-4">
      <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-3">Pages</h3>
      <div className="space-y-2.5">
        {pages.map((p) => {
          const st = PAGE_STATUS[p.status] ?? PAGE_STATUS.pending;
          return (
            <div key={p.id} className="flex items-center gap-2.5">
              <Avatar name={p.user.name} color={p.user.avatarColor} size={24} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{p.user.name}</p>
                <p className="text-[11px] text-dim">
                  L{p.level} · <TimeAgo date={p.sentAt} /> ·{" "}
                  <span style={{ color: st.color }}>{st.label}</span>
                </p>
              </div>
              {p.status === "pending" && !disabled && (
                <button className="btn btn-ghost !py-1 !px-2 !text-xs" disabled={busy} onClick={() => ack(p.id)}>
                  Ack
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
