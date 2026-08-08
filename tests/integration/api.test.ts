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
