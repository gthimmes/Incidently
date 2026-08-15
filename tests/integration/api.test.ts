/**
 * API integration tests — every route, over real HTTP against the running
 * Next.js server (dev or prod). The database is reseeded before and after
 * the suite so the app returns to demo state.
 *
 * Requires the app to be running: `npm run dev` (or `npm start`).
 * Override the target with APP_URL.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { execSync } from "child_process";
import path from "path";

const BASE = process.env.APP_URL || "http://localhost:3000";
const ROOT = path.resolve(__dirname, "../..");

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let ingestToken: string;

async function api(pathname: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body };
}

const post = (p: string, data?: unknown) =>
  api(p, { method: "POST", body: JSON.stringify(data ?? {}) });
const patch = (p: string, data: unknown) =>
  api(p, { method: "PATCH", body: JSON.stringify(data) });
const put = (p: string, data: unknown) => api(p, { method: "PUT", body: JSON.stringify(data) });

function reseed() {
  execSync("npx tsx prisma/seed.ts", { cwd: ROOT, stdio: "pipe" });
}

beforeAll(async () => {
  // The integration suite talks to the same db as the server — no override.
  delete process.env.DATABASE_URL;

  try {
    const health = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    if (!health.ok) throw new Error(`server responded ${health.status}`);
  } catch (e) {
    throw new Error(
      `Integration tests need the app running at ${BASE} (npm run dev). ${String(e)}`,
    );
  }

  reseed();
  ({ prisma } = await import("@/lib/db"));
  const { getIngestToken } = await import("@/lib/alerts");
  ingestToken = await getIngestToken();
}, 60_000);

afterAll(async () => {
  reseed(); // leave the app in demo state
  await prisma?.$disconnect();
}, 60_000);

async function declare(overrides: Record<string, unknown> = {}) {
  const service = await prisma.service.findUniqueOrThrow({ where: { slug: "internal-tools" } });
  const { status, body } = await post("/api/incidents", {
    title: "Integration test incident",
    severity: "sev3",
    serviceId: service.id,
    ...overrides,
  });
  expect(status).toBe(201);
  return body;
}

describe("incidents", () => {
  it("rejects declaration without title/severity", async () => {
    expect((await post("/api/incidents", { title: "x" })).status).toBe(400);
    expect((await post("/api/incidents", { severity: "sev1" })).status).toBe(400);
  });

  it("declares an incident: commander role, timeline, level-1 page, notifications", async () => {
    const service = await prisma.service.findUniqueOrThrow({ where: { slug: "web-app" } });
    const { status, body } = await post("/api/incidents", {
      title: "HTTP declare test",
      summary: "integration",
      severity: "sev2",
      serviceId: service.id,
    });
    expect(status).toBe(201);
    expect(body.number).toBeGreaterThan(1006);

    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: body.id },
      include: { roles: true, events: true, pages: { include: { notifications: true } } },
    });
    expect(incident.roles.some((r: any) => r.role === "commander")).toBe(true);
    expect(incident.events.some((e: any) => e.kind === "declared")).toBe(true);
    expect(incident.pages.length).toBeGreaterThan(0);
    expect(incident.pages[0].notifications.length).toBeGreaterThan(0);
    expect(incident.slackChannel).toMatch(/^#inc-\d+-/);

    // sev2 on the service degrades the status page
    const fresh = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(fresh.status).toBe("degraded");
  });

  it("GET /api/incidents runs the escalation sweep", async () => {
    const { status, body } = await api("/api/incidents");
    expect(status).toBe(200);
    expect(body).toHaveProperty("escalated");
  });

  it("PATCH changes severity with a timeline event, and rejects empty patches", async () => {
    const inc = await declare();
    const { status } = await patch(`/api/incidents/${inc.id}`, { severity: "sev1" });
    expect(status).toBe(200);
    const events = await prisma.incidentEvent.findMany({ where: { incidentId: inc.id } });
    expect(events.some((e: any) => e.kind === "severity_change")).toBe(true);
    expect((await patch(`/api/incidents/${inc.id}`, {})).status).toBe(400);
  });

  it("PATCH resolve settles pages and restores the service", async () => {
    const inc = await declare({ severity: "sev2", title: "Resolve me" });
    const { status } = await patch(`/api/incidents/${inc.id}`, { status: "resolved" });
    expect(status).toBe(200);
    const fresh = await prisma.incident.findUniqueOrThrow({
      where: { id: inc.id },
      include: { pages: true, postmortem: true },
    });
    expect(fresh.resolvedAt).not.toBeNull();
    expect(fresh.pages.every((p: any) => p.status !== "pending")).toBe(true);
    expect(fresh.postmortem).not.toBeNull(); // sev2 auto-postmortem
  });
});

describe("incident collaboration", () => {
  it("assigns and reassigns response roles", async () => {
    const inc = await declare();
    const [u1, u2] = await prisma.user.findMany({ take: 2, orderBy: { name: "asc" } });
    expect((await post(`/api/incidents/${inc.id}/roles`, { role: "comms", userId: u1.id })).status).toBe(200);
    expect((await post(`/api/incidents/${inc.id}/roles`, { role: "comms", userId: u2.id })).status).toBe(200);
    const role = await prisma.incidentRole.findUniqueOrThrow({
      where: { incidentId_role: { incidentId: inc.id, role: "comms" } },
    });
    expect(role.userId).toBe(u2.id); // upserted, not duplicated
    expect((await post(`/api/incidents/${inc.id}/roles`, { role: "comms" })).status).toBe(400);
  });

  it("publishes status updates stamped with the current incident status", async () => {
    const inc = await declare();
    await patch(`/api/incidents/${inc.id}`, { status: "investigating" });
    const { status, body } = await post(`/api/incidents/${inc.id}/updates`, {
      body: "We are looking into it.",
    });
    expect(status).toBe(201);
    expect(body.status).toBe("investigating");
    expect((await post(`/api/incidents/${inc.id}/updates`, {})).status).toBe(400);
  });

  it("adds timeline notes", async () => {
    const inc = await declare();
    const { status } = await post(`/api/incidents/${inc.id}/notes`, { message: "note from tests" });
    expect(status).toBe(201);
    const events = await prisma.incidentEvent.findMany({ where: { incidentId: inc.id, kind: "note" } });
    expect(events.some((e: any) => e.message === "note from tests")).toBe(true);
  });

  it("acks a page and stamps incident MTTA", async () => {
    const inc = await declare({ severity: "sev2", title: "Ack test" });
    const page = await prisma.page.findFirstOrThrow({ where: { incidentId: inc.id } });
    const { status } = await post(`/api/pages/${page.id}/ack`);
    expect(status).toBe(200);
    const fresh = await prisma.incident.findUniqueOrThrow({ where: { id: inc.id } });
    expect(fresh.acknowledgedAt).not.toBeNull();
  });

  it("manual escalation walks the policy levels then 400s past the last level", async () => {
    const inc = await declare({ severity: "sev2", title: "Escalate test" });
    expect((await post(`/api/incidents/${inc.id}/escalate`)).status).toBe(200); // → L2
    expect((await post(`/api/incidents/${inc.id}/escalate`)).status).toBe(200); // → L3
    expect((await post(`/api/incidents/${inc.id}/escalate`)).status).toBe(400); // no L4
    const levels = (await prisma.page.findMany({ where: { incidentId: inc.id } })).map((p: any) => p.level);
    expect(new Set(levels)).toEqual(new Set([1, 2, 3]));
  });
});

describe("action items and Jira", () => {
  it("creates, updates, and pushes an action item to Jira (mock mode)", async () => {
    const inc = await declare();
    const { status, body: item } = await post(`/api/incidents/${inc.id}/action-items`, {
      title: "Test remediation",
      priority: "high",
    });
    expect(status).toBe(201);

    expect((await patch(`/api/action-items/${item.id}`, { status: "in_progress" })).status).toBe(200);

    const jira = await post(`/api/action-items/${item.id}/jira`);
    expect(jira.status).toBe(201);
    expect(jira.body.issueKey).toMatch(/^OPS-\d+$/);
    const events = await prisma.incidentEvent.findMany({ where: { incidentId: inc.id, kind: "jira_linked" } });
    expect(events.length).toBe(1);

    expect((await post(`/api/incidents/${inc.id}/action-items`, {})).status).toBe(400);
  });
});

describe("postmortems", () => {
  it("upserts and updates postmortem fields", async () => {
    const inc = await declare();
    const first = await put(`/api/incidents/${inc.id}/postmortem`, { summary: "v1", rootCause: "rc" });
    expect(first.status).toBe(200);
    const second = await put(`/api/incidents/${inc.id}/postmortem`, { summary: "v2", status: "in_review" });
    expect(second.body.summary).toBe("v2");
    expect(second.body.rootCause).toBe("rc"); // untouched fields persist
    expect(second.body.status).toBe("in_review");
  });
});

describe("settings", () => {
  it("masks the Jira token on GET and preserves it when '•••' is sent back", async () => {
    await post("/api/settings/jira", { apiToken: "real-secret", mockMode: true });
    const { body } = await api("/api/settings/jira");
    expect(body.apiToken).toBe("•••");

    await post("/api/settings/jira", { apiToken: "•••", projectKey: "OPS" });
    const { getJiraConfig } = await import("@/lib/jira");
    expect((await getJiraConfig()).apiToken).toBe("real-secret");
  });

  it("test connection returns ok in mock mode", async () => {
    const { body } = await post("/api/settings/jira", { mockMode: true, test: true });
    expect(body.ok).toBe(true);
  });
});

describe("alert ingestion", () => {
  it("rejects bad tokens", async () => {
    const res = await fetch(`${BASE}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer nope" },
      body: JSON.stringify({ title: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates, dedups, and auto-resolves via the webhook", async () => {
    const send = (data: unknown) =>
      fetch(`${BASE}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ingestToken}` },
        body: JSON.stringify(data),
      }).then(async (r) => ({ status: r.status, body: await r.json() }));

    const first = await send({ title: "Int test alert", severity: "warning", dedup_key: "int-1", service: "search" });
    expect(first.status).toBe(202);
    expect(first.body.action).toBe("created");

    const dup = await send({ title: "Int test alert", severity: "warning", dedup_key: "int-1" });
    expect(dup.body.action).toBe("deduplicated");
    expect(dup.body.alert.count).toBe(2);

    const resolve = await send({ title: "Int test alert", dedup_key: "int-1", status: "resolved" });
    expect(resolve.body.action).toBe("auto_resolved");
  });

  it("critical on a tier-1 service with an open incident attaches instead of double-declaring", async () => {
    // seeded live incident INC-1006 is on payments
    const res = await fetch(`${BASE}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ingestToken}` },
      body: JSON.stringify({ title: "Payments alarm", severity: "critical", service: "payments", dedup_key: "int-crit-1" }),
    });
    const body = await res.json();
    expect(body.action).toBe("attached_to_incident");
  });

  it("alert PATCH supports ack, promote, and resolve", async () => {
    const created = await fetch(`${BASE}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ingestToken}` },
      body: JSON.stringify({ title: "Promote me", severity: "warning", service: "search", dedup_key: "int-promote" }),
    }).then((r) => r.json());
    const id = created.alert.id;

    expect((await patch(`/api/alerts/${id}`, { status: "acked" })).status).toBe(200);
    const promoted = await patch(`/api/alerts/${id}`, { action: "promote" });
    expect(promoted.status).toBe(200);
    expect(promoted.body.incidentId).toBeTruthy();
    // promoting twice is idempotent
    const again = await patch(`/api/alerts/${id}`, { action: "promote" });
    expect(again.body.incidentId).toBe(promoted.body.incidentId);
    expect((await patch(`/api/alerts/${id}`, { status: "resolved" })).status).toBe(200);
  });

  it("test-alert endpoint drives the real pipeline", async () => {
    const { status, body } = await post("/api/alerts/test", { kind: "warning" });
    expect(status).toBe(200);
    expect(["created", "deduplicated"]).toContain(body.action);
  });
});

describe("runbooks", () => {
  it("creates and updates runbooks", async () => {
    const service = await prisma.service.findUniqueOrThrow({ where: { slug: "search" } });
    const { status, body } = await post("/api/runbooks", {
      title: "Integration runbook",
      content: "# Steps\n1. Do the thing",
      serviceId: service.id,
    });
    expect(status).toBe(201);

    const updated = await put(`/api/runbooks/${body.id}`, {
      title: "Integration runbook v2",
      content: "changed",
      serviceId: null,
    });
    expect(updated.body.title).toBe("Integration runbook v2");
    expect(updated.body.serviceId).toBeNull();
    expect((await post("/api/runbooks", {})).status).toBe(400);
  });
});

describe("on-call overrides", () => {
  it("override makes the chosen user on-call immediately", async () => {
    const schedule = await prisma.schedule.findFirstOrThrow({ where: { name: "Platform Primary" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "priya@aiwyn.ai" } });
    const { status, body } = await post(`/api/schedules/${schedule.id}/override`, {
      userId: user.id,
      hours: 4,
    });
    expect(status).toBe(200);
    expect(body.message).toContain("Priya Sharma is now on call");

    const { whoIsOnCall } = await import("@/lib/escalation");
    expect((await whoIsOnCall(schedule.id))?.id).toBe(user.id);
    expect((await post(`/api/schedules/${schedule.id}/override`, { userId: user.id })).status).toBe(400);
  });
});

describe("maintenance windows", () => {
  it("validates input and rejects unknown services", async () => {
    expect((await post("/api/maintenance", { title: "x" })).status).toBe(400);
    const svc = await prisma.service.findUniqueOrThrow({ where: { slug: "search" } });
    expect(
      (
        await post("/api/maintenance", {
          title: "backwards window",
          serviceId: svc.id,
          startsAt: new Date(Date.now() + 3600_000).toISOString(),
          endsAt: new Date().toISOString(),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post("/api/maintenance", {
          title: "ghost service",
          serviceId: "nope",
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 3600_000).toISOString(),
        })
      ).status,
    ).toBe(404);
  });

  it("schedules and cancels a window; active windows flip the effective status", async () => {
    const svc = await prisma.service.findUniqueOrThrow({ where: { slug: "notifications" } });
    const { status, body } = await post("/api/maintenance", {
      title: "Mail relay upgrade",
      serviceId: svc.id,
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(status).toBe(201);

    const { effectiveServiceStatuses } = await import("@/lib/maintenance");
    const map = await effectiveServiceStatuses([svc.id]);
    expect(map.get(svc.id)?.effectiveStatus).toBe("maintenance");

    expect((await patch(`/api/maintenance/${body.id}`, { action: "cancel" })).status).toBe(200);
    const after = await effectiveServiceStatuses([svc.id]);
    expect(after.get(svc.id)?.effectiveStatus).toBe("operational");
    expect((await patch(`/api/maintenance/${body.id}`, {})).status).toBe(400);
  });
});

describe("slack broadcasting", () => {
  it("declaring an incident records a #incidents broadcast in the feed", async () => {
    const inc = await declare({ title: "Slack broadcast test", severity: "sev3" });
    const slack = await prisma.notification.findMany({
      where: { incidentId: inc.id, channel: "slack" },
    });
    expect(slack.length).toBeGreaterThan(0);
    expect(slack[0].recipient).toBe("#incidents");
    expect(slack[0].body).toContain(`INC-${inc.number}`);
  });

  it("status changes and published updates broadcast too", async () => {
    const inc = await declare({ title: "Slack lifecycle test", severity: "sev3" });
    await patch(`/api/incidents/${inc.id}`, { status: "investigating" });
    await post(`/api/incidents/${inc.id}/updates`, { body: "Slack update body" });

    const slack = await prisma.notification.findMany({
      where: { incidentId: inc.id, channel: "slack" },
      orderBy: { createdAt: "asc" },
    });
    expect(slack.length).toBeGreaterThanOrEqual(3); // declare + status + update
    expect(slack.some((n: any) => n.body.includes("Investigating"))).toBe(true);
    expect(slack.some((n: any) => n.body.includes("Slack update body"))).toBe(true);
  });
});

describe("public API v1 + keys", () => {
  let token = "";

  it("creates a key (token shown once), lists with prefix only", async () => {
    const created = await post("/api/apikeys", { name: "integration-key" });
    expect(created.status).toBe(201);
    expect(created.body.token).toMatch(/^ink_live_[0-9a-f]{40}$/);
    token = created.body.token;

    const list = await api("/api/apikeys");
    const row = list.body.keys.find((k: any) => k.name === "integration-key");
    expect(row).toBeTruthy();
    expect(row.token).toBeUndefined();
    expect(row.prefix).toBe(token.slice(0, 12));
    expect((await post("/api/apikeys", {})).status).toBe(400);
  });

  it("v1 endpoints require a valid key", async () => {
    for (const p of ["/api/v1/incidents", "/api/v1/services", "/api/v1/oncall"]) {
      const res = await fetch(`${BASE}${p}`);
      expect(res.status).toBe(401);
    }
  });

  it("lists incidents, fetches detail, exposes SLO burn and on-call", async () => {
    const h = { Authorization: `Bearer ${token}` };
    const list = await fetch(`${BASE}/api/v1/incidents?status=open`, { headers: h }).then((r) => r.json());
    expect(list.incidents.length).toBeGreaterThan(0);
    expect(list.incidents[0]).toHaveProperty("declared_at");

    const detail = await fetch(`${BASE}/api/v1/incidents/1006`, { headers: h }).then((r) => r.json());
    expect(detail.incident.number).toBe(1006);
    expect(detail.incident.timeline.length).toBeGreaterThan(0);
    expect(
      (await fetch(`${BASE}/api/v1/incidents/999999`, { headers: h })).status,
    ).toBe(404);

    const services = await fetch(`${BASE}/api/v1/services`, { headers: h }).then((r) => r.json());
    const payments = services.services.find((s: any) => s.slug === "payments");
    expect(payments.slo).toMatchObject({ target_pct: 99.9, window_days: 30 });
    expect(typeof payments.slo.burn_pct).toBe("number");

    const oncall = await fetch(`${BASE}/api/v1/oncall`, { headers: h }).then((r) => r.json());
    expect(oncall.oncall.length).toBe(2);
    expect(oncall.oncall[0].on_call).toHaveProperty("name");
  });

  it("declares an incident through v1 (pages on-call), validates input", async () => {
    const h = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const res = await fetch(`${BASE}/api/v1/incidents`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ title: "v1 declared incident", severity: "sev3", service: "internal-tools" }),
    });
    expect(res.status).toBe(201);
    const { incident } = await res.json();
    expect(incident.service.slug).toBe("internal-tools");

    const row = await prisma.incident.findUniqueOrThrow({
      where: { number: incident.number },
      include: { pages: true },
    });
    expect(row.pages.length).toBeGreaterThan(0); // paging fired

    expect(
      (await fetch(`${BASE}/api/v1/incidents`, { method: "POST", headers: h, body: JSON.stringify({ title: "x", severity: "sev9" }) })).status,
    ).toBe(400);
    expect(
      (await fetch(`${BASE}/api/v1/incidents`, { method: "POST", headers: h, body: JSON.stringify({ title: "x", severity: "sev3", service: "ghost" }) })).status,
    ).toBe(404);
  });

  it("revoked keys stop working immediately", async () => {
    const created = await post("/api/apikeys", { name: "short-lived" });
    const shortToken = created.body.token;
    const keyId = created.body.id;
    expect(
      (await fetch(`${BASE}/api/v1/oncall`, { headers: { Authorization: `Bearer ${shortToken}` } })).status,
    ).toBe(200);
    await patch(`/api/apikeys/${keyId}`, { action: "revoke" });
    expect(
      (await fetch(`${BASE}/api/v1/oncall`, { headers: { Authorization: `Bearer ${shortToken}` } })).status,
    ).toBe(401);
  });
});

describe("SLO config + CSV export", () => {
  it("PUT slo validates and upserts", async () => {
    const svc = await prisma.service.findUniqueOrThrow({ where: { slug: "internal-tools" } });
    expect((await put(`/api/services/${svc.id}/slo`, { targetPct: 150 })).status).toBe(400);
    expect((await put(`/api/services/nope/slo`, { targetPct: 99.5 })).status).toBe(404);
    const { status, body } = await put(`/api/services/${svc.id}/slo`, { targetPct: 99.5 });
    expect(status).toBe(200);
    expect(body.targetPct).toBe(99.5);
    // upsert: changing the target updates in place
    const again = await put(`/api/services/${svc.id}/slo`, { targetPct: 99 });
    expect(again.body.id).toBe(body.id);
  });

  it("exports incident history as CSV with lifecycle columns", async () => {
    const res = await fetch(`${BASE}/api/export/incidents`);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    const [header] = text.split("\r\n");
    expect(header).toBe(
      "number,title,severity,status,service,commander,declared_at,acknowledged_at,mitigated_at,resolved_at,mtta_minutes,mttr_minutes,postmortem_status",
    );
    expect(text).toContain("INC-1001");
    expect(text).toContain("Database connection pool exhaustion");
  });
});

describe("response checklists", () => {
  it("declaring an incident attaches the severity's checklist", async () => {
    const incident = await declare({ severity: "sev2" });
    const items = await prisma.checklistItem.findMany({
      where: { incidentId: incident.id },
      orderBy: { order: "asc" },
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].text).toContain("acknowledged the page");
  });

  it("sev0 attaches the all-hands checklist and takes the service to major_outage", async () => {
    const incident = await declare({ severity: "sev0", title: "Total outage drill" });
    const items = await prisma.checklistItem.findMany({
      where: { incidentId: incident.id },
      orderBy: { order: "asc" },
    });
    expect(items.some((i: any) => i.text.includes("war room"))).toBe(true);
    expect(items.some((i: any) => i.text.includes("executive leadership"))).toBe(true);

    const svc = await prisma.service.findUniqueOrThrow({ where: { slug: "internal-tools" } });
    expect(svc.status).toBe("major_outage");
    // restore for later tests
    await patch(`/api/incidents/${incident.id}`, { status: "resolved" });
  });

  it("PATCH /api/checklist/:id toggles done and logs a timeline event", async () => {
    const incident = await declare({ severity: "sev3" });
    const item = await prisma.checklistItem.findFirstOrThrow({ where: { incidentId: incident.id } });

    expect((await patch(`/api/checklist/${item.id}`, { done: "yes" })).status).toBe(400);

    const { status, body } = await patch(`/api/checklist/${item.id}`, { done: true });
    expect(status).toBe(200);
    expect(body.done).toBe(true);
    expect(body.doneById).not.toBeNull();

    const event = await prisma.incidentEvent.findFirst({
      where: { incidentId: incident.id, kind: "checklist" },
    });
    expect(event).not.toBeNull();
  });
});

describe("outbound webhooks", () => {
  let hookId: string;
  let secret: string;

  it("POST /api/webhooks validates and returns the secret exactly once", async () => {
    expect((await post("/api/webhooks", { name: "x" })).status).toBe(400);
    expect((await post("/api/webhooks", { name: "x", url: "not-a-url" })).status).toBe(400);
    expect(
      (await post("/api/webhooks", { name: "x", url: `${BASE}/api/dev/echo`, events: ["bogus.event"] })).status,
    ).toBe(400);

    const { status, body } = await post("/api/webhooks", {
      name: "integration-hook",
      url: `${BASE}/api/dev/echo`,
      events: ["incident.declared"],
    });
    expect(status).toBe(201);
    expect(body.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
    hookId = body.id;
    secret = body.secret;

    // reads never expose the secret
    const list = await api("/api/webhooks");
    const mine = list.body.find((h: any) => h.id === hookId);
    expect(mine).toBeDefined();
    expect(mine.secret).toBeUndefined();
  });

  it("declaring an incident delivers a signed event to the endpoint", async () => {
    const before = await prisma.webhookDelivery.count({ where: { subscriptionId: hookId } });
    await declare({ severity: "sev4", title: "Webhook delivery test" });
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { subscriptionId: hookId },
      orderBy: { createdAt: "desc" },
    });
    expect(deliveries.length).toBe(before + 1);
    const d = deliveries[0];
    expect(d.event).toBe("incident.declared");
    expect(d.status).toBe("success");
    expect(d.statusCode).toBe(200);
    const payload = JSON.parse(d.payload);
    expect(payload.data.title).toBe("Webhook delivery test");
    expect(secret).toBeTruthy(); // secret was only handed out at creation
  });

  it("filtered events are not delivered", async () => {
    const incident = await declare({ severity: "sev4" });
    const before = await prisma.webhookDelivery.count({ where: { subscriptionId: hookId } });
    await patch(`/api/incidents/${incident.id}`, { status: "investigating" });
    // subscription only wants incident.declared — status change must not deliver
    expect(await prisma.webhookDelivery.count({ where: { subscriptionId: hookId } })).toBe(before);
  });

  it("test ping and redelivery both log deliveries", async () => {
    const ping = await post(`/api/webhooks/${hookId}/test`);
    expect(ping.status).toBe(201);
    expect(ping.body.event).toBe("ping");
    expect(ping.body.status).toBe("success");

    const redo = await post(`/api/webhooks/deliveries/${ping.body.id}`);
    expect(redo.status).toBe(201);
    expect(redo.body.payload).toBe(ping.body.payload);
    expect(redo.body.id).not.toBe(ping.body.id);
  });

  it("paused hooks receive nothing; DELETE removes the subscription", async () => {
    expect((await patch(`/api/webhooks/${hookId}`, { active: "no" })).status).toBe(400);
    expect((await patch(`/api/webhooks/${hookId}`, { active: false })).body.active).toBe(false);

    const before = await prisma.webhookDelivery.count({ where: { subscriptionId: hookId } });
    await declare({ severity: "sev4" });
    expect(await prisma.webhookDelivery.count({ where: { subscriptionId: hookId } })).toBe(before);

    const del = await api(`/api/webhooks/${hookId}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(await prisma.webhookSubscription.findUnique({ where: { id: hookId } })).toBeNull();
  });
});

describe("search", () => {
  it("finds incidents by number, and services/runbooks by name", async () => {
    const byNumber = await api("/api/search?q=1006");
    expect(byNumber.body.results.some((r: any) => r.title.startsWith("INC-1006"))).toBe(true);

    const byName = await api("/api/search?q=payments");
    const kinds = new Set(byName.body.results.map((r: any) => r.kind));
    expect(kinds.has("service")).toBe(true);

    const runbook = await api("/api/search?q=comms cadence");
    expect(runbook.body.results.some((r: any) => r.kind === "runbook")).toBe(true);
  });

  it("returns nothing for sub-2-char queries", async () => {
    const { body } = await api("/api/search?q=a");
    expect(body.results).toEqual([]);
  });
});
