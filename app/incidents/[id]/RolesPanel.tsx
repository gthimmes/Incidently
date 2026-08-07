"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui";

interface Props {
  incidentId: string;
  roles: { role: string; user: { id: string; name: string; avatarColor: string } }[];
  users: { id: string; name: string; avatarColor: string }[];
  roleDefs: Record<string, { label: string; short: string; description: string }>;
  disabled: boolean;
}

export default function RolesPanel({ incidentId, roles, users, roleDefs, disabled }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function assign(role: string, userId: string) {
    if (!userId) return;
    setBusy(true);
    await fetch(`/api/incidents/${incidentId}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, userId }),
    });
    router.refresh();
    setBusy(false);
  }

  return (
    <section className="card p-4">
      <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-3">Response roles</h3>
      <div className="space-y-3">
        {Object.entries(roleDefs).map(([key, def]) => {
          const assigned = roles.find((r) => r.role === key)?.user;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" title={def.description}>{def.label}</p>
                {assigned ? (
                  <p className="text-xs text-dim flex items-center gap-1.5 mt-0.5">
                    <Avatar name={assigned.name} color={assigned.avatarColor} size={16} />
                    {assigned.name}
                  </p>
                ) : (
                  <p className="text-xs text-dim/60 mt-0.5">Unassigned</p>
                )}
              </div>
              {!disabled && (
                <select
                  className="input !w-28 !py-1 !text-xs"
                  value=""
                  disabled={busy}
                  onChange={(e) => assign(key, e.target.value)}
                >
                  <option value="">{assigned ? "Reassign…" : "Assign…"}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
