/**
 * Engine tests: alert ingestion, escalation/on-call, incident lifecycle.
 *
 * Runs against an isolated copy of the SQLite database (schema cloned from
 * prisma/dev.db) so `npm test` never touches your real data. The simulator
 * notification provider means no external calls are made.
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const SRC_DB = path.resolve(__dirname, "../prisma/dev.db");
const TEST_DB = path.resolve(__dirname, `../prisma/test-${process.pid}.db`);

// Set the override BEFORE importing anything that touches lib/db.
process.env.DATABASE_URL = `file:${TEST_DB.replace(/\\/g, "/")}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let ingestAlert: any, promoteAlert: any;
let whoIsOnCall: any, sweepEscalations: any, fireLevel: any;
let declareIncident: any, changeIncidentStatus: any, acknowledgePage: any;

const HOUR = 3600_000;

async function wipe() {
  await prisma.notification.deleteMany();
  await prisma.page.deleteMany();
  await prisma.jiraLink.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.postmortem.deleteMany();
  await prisma.statusUpdate.deleteMany();
  await prisma.incidentEvent.deleteMany();
  await prisma.incidentRole.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.escalationTarget.deleteMany();
  await prisma.escalationLevel.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.runbook.deleteMany();
  await prisma.service.deleteMany();
  await prisma.escalationPolicy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
}

// Minimal world: 2 users, primary schedule (alice on call), 2-level policy
// (schedule → bob), one tier-1 and one tier-2 service.
async function fixtures() {
  const alice = await prisma.user.create({
    data: { name: "Alice Admin", email: "alice@test.dev", phone: "+15550000001", role: "admin" },
  });
  const bob = await prisma.user.create({
    data: { name: "Bob Backup", email: "bob@test.dev", phone: "+15550000002" },
  });
  const schedule = await prisma.schedule.create({ data: { name: "Primary" } });
  await prisma.shift.create({
    data: {
      scheduleId: schedule.id,
      userId: alice.id,
      startsAt: new Date(Date.now() - 24 * HOUR),
      endsAt: new Date(Date.now() + 24 * HOUR),
    },
  });
  const policy = await prisma.escalationPolicy.create({ data: { name: "Standard" } });
  const l1 = await prisma.escalationLevel.create({
    data: { policyId: policy.id, levelNumber: 1, delayMinutes: 5 },
  });
  const l2 = await prisma.escalationLevel.create({
    data: { policyId: policy.id, levelNumber: 2, delayMinutes: 10 },
  });
  await prisma.escalationTarget.create({ data: { levelId: l1.id, scheduleId: schedule.id } });
  await prisma.escalationTarget.create({ data: { levelId: l2.id, userId: bob.id } });

  const tier1 = await prisma.service.create({
    data: { name: "Core API", slug: "core-api", tier: 1, escalationPolicyId: policy.id },
  });
  const tier2 = await prisma.service.create({
    data: { name: "Search", slug: "search", tier: 2, escalationPolicyId: policy.id },
  });
  return { alice, bob, schedule, policy, tier1, tier2 };
}

beforeAll(async () => {
  fs.copyFileSync(SRC_DB, TEST_DB); // clone schema
  ({ prisma } = await import("@/lib/db"));
  ({ ingestAlert, promoteAlert } = await import("@/lib/alerts"));
  ({ whoIsOnCall, sweepEscalations, fireLevel } = await import("@/lib/escalation"));
  ({ declareIncident, changeIncidentStatus, acknowledgePage } = await import("@/lib/actions"));
});

afterAll(async () => {
  await prisma.$disconnect();
  try {
    fs.unlinkSync(TEST_DB);
  } catch {
    /* windows may hold the handle briefly; test dbs are gitignored */
  }
});

beforeEach(async () => {
  await wipe();
});

describe("alert ingestion", () => {
  it("creates a warning alert without declaring an incident", async () => {
    await fixtures();
    const result = await ingestAlert({
      title: "P95 latency high",
      severity: "warning",
      service: "search",
      dedup_key: "lat-1",
    });
    expect(result.action).toBe("created");
    expect(await prisma.incident.count()).toBe(0);
    expect(result.alert.serviceId).toBeTruthy();
  });

  it("dedups repeat alerts by dedup_key and bumps the counter", async () => {
    await fixtures();
    await ingestAlert({ title: "x", severity: "warning", dedup_key: "k1" });
    const second = await ingestAlert({ title: "x", severity: "warning", dedup_key: "k1" });
    expect(second.action).toBe("deduplicated");
    expect(second.alert.count).toBe(2);
    expect(await prisma.alert.count()).toBe(1);
  });

  it("auto-closes open alerts when the source sends status=resolved", async () => {
    await fixtures();
    await ingestAlert({ title: "x", severity: "warning", dedup_key: "k2" });
    const result = await ingestAlert({ title: "x", dedup_key: "k2", status: "resolved" });
    expect(result.action).toBe("auto_resolved");
    expect(result.resolved).toBe(1);
    const alert = await prisma.alert.findFirst();
    expect(alert.status).toBe("resolved");
  });

  it("critical on tier-1 auto-declares a SEV1 and pages on-call", async () => {
    const { alice } = await fixtures();
    const result = await ingestAlert({
      title: "Core API down",
      severity: "critical",
      service: "core-api",
      dedup_key: "down-1",
    });
    expect(result.action).toBe("incident_declared");
    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: result.incidentId },
      include: { pages: true },
    });
    expect(incident.severity).toBe("sev1");
    expect(incident.pages).toHaveLength(1);
    expect(incident.pages[0].userId).toBe(alice.id); // resolved via the schedule
    // paging fanned out (sms + voice for sev1, email, push)
    const notifications = await prisma.notification.findMany({ where: { pageId: incident.pages[0].id } });
    expect(notifications.map((n: { channel: string }) => n.channel).sort()).toEqual(
      ["email", "push", "sms", "voice"],
    );
  });

  it("critical on tier-2 declares SEV2; second critical attaches instead of storming", async () => {
    await fixtures();
    const first = await ingestAlert({ title: "Search down", severity: "critical", service: "search", dedup_key: "s1" });
    expect(first.action).toBe("incident_declared");
    const incident = await prisma.incident.findUniqueOrThrow({ where: { id: first.incidentId } });
    expect(incident.severity).toBe("sev2");

    const second = await ingestAlert({ title: "Search flaky", severity: "critical", service: "search", dedup_key: "s2" });
    expect(second.action).toBe("attached_to_incident");
    expect(second.incidentId).toBe(first.incidentId);
    expect(await prisma.incident.count()).toBe(1);
  });

  it("manual promote turns a warning alert into a SEV3 incident", async () => {
    await fixtures();
    const { alert } = await ingestAlert({ title: "Queue depth rising", severity: "warning", service: "search" });
    const { incidentId } = await promoteAlert(alert.id);
    const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
    expect(incident.severity).toBe("sev3");
    const updated = await prisma.alert.findUniqueOrThrow({ where: { id: alert.id } });
    expect(updated.incidentId).toBe(incidentId);
  });
});

describe("on-call and escalation", () => {
  it("resolves who is on call, and a later-starting override shift wins", async () => {
    const { alice, bob, schedule } = await fixtures();
    expect((await whoIsOnCall(schedule.id)).id).toBe(alice.id);

    // Bob takes an override starting now — most recent startsAt wins.
    await prisma.shift.create({
      data: {
        scheduleId: schedule.id,
        userId: bob.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 8 * HOUR),
      },
    });
    expect((await whoIsOnCall(schedule.id)).id).toBe(bob.id);
  });

  it("sweep escalates unacked pages past their level delay to the next level", async () => {
    const { alice, bob, tier1 } = await fixtures();
    const incident = await declareIncident({ title: "Down", severity: "sev1", serviceId: tier1.id });

    // Backdate the level-1 page past the 5-minute delay.
    await prisma.page.updateMany({
      where: { incidentId: incident.id },
      data: { sentAt: new Date(Date.now() - 6 * 60_000) },
    });
    const result = await sweepEscalations();
    expect(result.escalated).toBe(1);

    const pages = await prisma.page.findMany({ orderBy: { level: "asc" } });
    expect(pages).toHaveLength(2);
    expect(pages[0].status).toBe("timed_out");
    expect(pages[0].userId).toBe(alice.id);
    expect(pages[1].level).toBe(2);
    expect(pages[1].userId).toBe(bob.id);
  });

  it("acknowledged pages do not escalate", async () => {
    const { tier1 } = await fixtures();
    const incident = await declareIncident({ title: "Down", severity: "sev1", serviceId: tier1.id });
    const page = await prisma.page.findFirstOrThrow({ where: { incidentId: incident.id } });
    await acknowledgePage(page.id);
    await prisma.page.update({ where: { id: page.id }, data: { sentAt: new Date(Date.now() - 60 * 60_000) } });

    const result = await sweepEscalations();
    expect(result.escalated).toBe(0);
    expect(await prisma.page.count()).toBe(1);

    // ack also stamps the incident's MTTA timestamp
    const fresh = await prisma.incident.findUniqueOrThrow({ where: { id: incident.id } });
    expect(fresh.acknowledgedAt).not.toBeNull();
  });

  it("fireLevel dedups users targeted via both schedule and direct reference", async () => {
    const { alice, schedule, policy, tier1 } = await fixtures();
    // Add alice directly to level 2 alongside... make a level targeting both
    const l3 = await prisma.escalationLevel.create({
      data: { policyId: policy.id, levelNumber: 3, delayMinutes: 5 },
    });
    await prisma.escalationTarget.create({ data: { levelId: l3.id, userId: alice.id } });
    await prisma.escalationTarget.create({ data: { levelId: l3.id, scheduleId: schedule.id } });

    const incident = await declareIncident({ title: "Down", severity: "sev2", serviceId: tier1.id });
    await prisma.page.deleteMany(); // clear level-1 pages for a clean count
    const { paged } = await fireLevel(incident.id, 3);
    expect(paged).toEqual(["Alice Admin"]); // once, not twice
  });
});

describe("incident lifecycle", () => {
  it("declare stamps roles, timeline, service status, and pages level 1", async () => {
    const { tier1 } = await fixtures();
    const incident = await declareIncident({ title: "Big outage", severity: "sev1", serviceId: tier1.id });

    const roles = await prisma.incidentRole.findMany({ where: { incidentId: incident.id } });
    expect(roles.map((r: { role: string }) => r.role)).toContain("commander");

    const service = await prisma.service.findUniqueOrThrow({ where: { id: tier1.id } });
    expect(service.status).toBe("major_outage");

    const events = await prisma.incidentEvent.findMany({ where: { incidentId: incident.id } });
    expect(events.some((e: { kind: string }) => e.kind === "declared")).toBe(true);
    expect(events.some((e: { kind: string }) => e.kind === "page_sent")).toBe(true);
  });

  it("resolve closes pages, restores service, and auto-creates a postmortem for sev1", async () => {
    const { tier1 } = await fixtures();
    const incident = await declareIncident({ title: "Big outage", severity: "sev1", serviceId: tier1.id });
    await changeIncidentStatus(incident.id, "resolved");

    const fresh = await prisma.incident.findUniqueOrThrow({
      where: { id: incident.id },
      include: { postmortem: true, pages: true },
    });
    expect(fresh.resolvedAt).not.toBeNull();
    expect(fresh.mitigatedAt).not.toBeNull();
    expect(fresh.postmortem).not.toBeNull();
    expect(fresh.pages.every((p: { status: string }) => p.status !== "pending")).toBe(true);

    const service = await prisma.service.findUniqueOrThrow({ where: { id: tier1.id } });
    expect(service.status).toBe("operational");
  });

  it("sev3 resolve does not force a postmortem; service stays operational throughout", async () => {
    const { tier2 } = await fixtures();
    const incident = await declareIncident({ title: "Minor blip", severity: "sev3", serviceId: tier2.id });

    let service = await prisma.service.findUniqueOrThrow({ where: { id: tier2.id } });
    expect(service.status).toBe("operational"); // only sev1/sev2 degrade the status page

    await changeIncidentStatus(incident.id, "resolved");
    const fresh = await prisma.incident.findUniqueOrThrow({
      where: { id: incident.id },
      include: { postmortem: true },
    });
    expect(fresh.postmortem).toBeNull();
  });

  it("service stays degraded on resolve while another incident is still open", async () => {
    const { tier1 } = await fixtures();
    const first = await declareIncident({ title: "Outage A", severity: "sev1", serviceId: tier1.id });
    await declareIncident({ title: "Outage B", severity: "sev2", serviceId: tier1.id });

    await changeIncidentStatus(first.id, "resolved");
    const service = await prisma.service.findUniqueOrThrow({ where: { id: tier1.id } });
    expect(service.status).not.toBe("operational"); // B is still open
  });
});
