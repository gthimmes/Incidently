"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OverrideButton({
  scheduleId,
  users,
}: {
  scheduleId: string;
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [hours, setHours] = useState("8");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function takeOverride() {
    if (!userId) return;
    setBusy(true);
    const res = await fetch(`/api/schedules/${scheduleId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, hours: Number(hours) }),
    });
    const data = await res.json();
    setMessage(data.message ?? "Override created");
    setOpen(false);
    router.refresh();
    setBusy(false);
  }

  return (
    <div>
      {!open ? (
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost !py-1.5 !text-xs" onClick={() => setOpen(true)}>
            ⇄ Override
          </button>
          {message && <span className="text-xs text-green-400">{message}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap animate-in">
          <select className="input !w-40 !py-1 !text-xs" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Who takes over?</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select className="input !w-24 !py-1 !text-xs" value={hours} onChange={(e) => setHours(e.target.value)}>
            {["2", "4", "8", "12", "24", "48"].map((h) => (
              <option key={h} value={h}>{h}h</option>
            ))}
          </select>
          <button className="btn btn-primary !py-1 !text-xs" disabled={busy || !userId} onClick={takeOverride}>
            Take override
          </button>
          <button className="btn btn-ghost !py-1 !text-xs" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
