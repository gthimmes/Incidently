export const SEVERITIES = {
  sev1: { label: "SEV1", name: "Critical", color: "#ef4444", description: "Full outage or severe customer impact" },
  sev2: { label: "SEV2", name: "Major", color: "#f97316", description: "Partial outage, significant degradation" },
  sev3: { label: "SEV3", name: "Minor", color: "#eab308", description: "Minor degradation, limited impact" },
  sev4: { label: "SEV4", name: "Low", color: "#3b82f6", description: "Cosmetic or internal-only issue" },
} as const;

export type SeverityKey = keyof typeof SEVERITIES;

export const INCIDENT_STATUSES = {
  triage: { label: "Triage", color: "#ef4444", description: "Just declared, assessing impact" },
  investigating: { label: "Investigating", color: "#f97316", description: "Actively investigating root cause" },
  identified: { label: "Identified", color: "#eab308", description: "Cause identified, fix in progress" },
  monitoring: { label: "Monitoring", color: "#3b82f6", description: "Fix applied, watching for recurrence" },
  resolved: { label: "Resolved", color: "#22c55e", description: "Incident closed" },
} as const;

export type IncidentStatusKey = keyof typeof INCIDENT_STATUSES;

export const STATUS_ORDER: IncidentStatusKey[] = [
  "triage",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
];

export const INCIDENT_ROLES = {
  commander: { label: "Incident Commander", short: "IC", description: "Owns the response, makes the calls" },
  comms: { label: "Comms Lead", short: "Comms", description: "Handles stakeholder & customer updates" },
  ops: { label: "Ops Lead", short: "Ops", description: "Drives technical investigation & mitigation" },
  scribe: { label: "Scribe", short: "Scribe", description: "Keeps the timeline accurate" },
} as const;

export type IncidentRoleKey = keyof typeof INCIDENT_ROLES;

export const SERVICE_STATUSES = {
  operational: { label: "Operational", color: "#22c55e" },
  degraded: { label: "Degraded Performance", color: "#eab308" },
  partial_outage: { label: "Partial Outage", color: "#f97316" },
  major_outage: { label: "Major Outage", color: "#ef4444" },
  maintenance: { label: "Maintenance", color: "#3b82f6" },
} as const;

export const ACTION_ITEM_STATUSES = {
  open: { label: "Open", color: "#94a3b8" },
  in_progress: { label: "In Progress", color: "#3b82f6" },
  done: { label: "Done", color: "#22c55e" },
  wont_do: { label: "Won't Do", color: "#64748b" },
} as const;

export const PM_STATUSES = {
  draft: { label: "Draft", color: "#94a3b8" },
  in_review: { label: "In Review", color: "#eab308" },
  published: { label: "Published", color: "#22c55e" },
} as const;
