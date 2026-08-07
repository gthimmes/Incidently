// Shared presentational components (server-safe).
import {
  SEVERITIES,
  INCIDENT_STATUSES,
  SERVICE_STATUSES,
  ACTION_ITEM_STATUSES,
  PM_STATUSES,
  type SeverityKey,
  type IncidentStatusKey,
} from "@/lib/constants";

export function SeverityBadge({ severity, size = "sm" }: { severity: string; size?: "sm" | "lg" }) {
  const sev = SEVERITIES[severity as SeverityKey] ?? SEVERITIES.sev4;
  return (
    <span
      className={`inline-flex items-center font-bold rounded-md ${
        size === "lg" ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]"
      }`}
      style={{ background: `${sev.color}22`, color: sev.color, border: `1px solid ${sev.color}55` }}
    >
      {sev.label}
    </span>
  );
}

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const st = INCIDENT_STATUSES[status as IncidentStatusKey] ?? INCIDENT_STATUSES.triage;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
      style={{ background: `${st.color}18`, color: st.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: st.color }}
      />
      {st.label}
    </span>
  );
}

export function ServiceStatusBadge({ status }: { status: string }) {
  const st = SERVICE_STATUSES[status as keyof typeof SERVICE_STATUSES] ?? SERVICE_STATUSES.operational;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: st.color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
      {st.label}
    </span>
  );
}

export function ActionStatusBadge({ status }: { status: string }) {
  const st = ACTION_ITEM_STATUSES[status as keyof typeof ACTION_ITEM_STATUSES] ?? ACTION_ITEM_STATUSES.open;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
      style={{ background: `${st.color}18`, color: st.color }}
    >
      {st.label}
    </span>
  );
}

export function PmStatusBadge({ status }: { status: string }) {
  const st = PM_STATUSES[status as keyof typeof PM_STATUSES] ?? PM_STATUSES.draft;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
      style={{ background: `${st.color}18`, color: st.color }}
    >
      {st.label}
    </span>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function TimeAgo({ date }: { date: Date | string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  let label: string;
  if (mins < 1) label = "just now";
  else if (mins < 60) label = `${mins}m ago`;
  else if (mins < 60 * 24) label = `${Math.round(mins / 60)}h ago`;
  else label = `${Math.round(mins / (60 * 24))}d ago`;
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} suppressHydrationWarning>
      {label}
    </time>
  );
}

export function Duration({ from, to }: { from: Date | string; to?: Date | string | null }) {
  const a = new Date(from).getTime();
  const b = to ? new Date(to).getTime() : Date.now();
  const mins = Math.max(0, Math.round((b - a) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return <span suppressHydrationWarning>{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-dim font-medium">{title}</p>
      {subtitle && <p className="text-dim/70 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
