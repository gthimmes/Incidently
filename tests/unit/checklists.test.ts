/**
 * Response checklist unit tests: template seeding, instantiation on
 * declare, and tick-off with timeline events.
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { initTestDb, cleanupTestDb, wipeAll } from "./test-db";

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let DEFAULT_TEMPLATES: any, ensureDefaultTemplates: any, instantiateChecklist: any;
let toggleChecklistItem: any, checklistProgress: any;
let dbFile: string;

beforeAll(async () => {
  dbFile = initTestDb("checklists");
  ({ prisma } = await import("@/lib/db"));
  ({
    DEFAULT_TEMPLATES,
    ensureDefaultTemplates,
    instantiateChecklist,
    toggleChecklistItem,
    checklistProgress,
  } = await import("@/lib/checklists"));
});

afterAll(async () => {
  await prisma.$disconnect();
  cleanupTestDb(dbFile);
});

let admin: any;
let incident: any;

beforeEach(async () => {
  await wipeAll(prisma);
  admin = await prisma.user.create({
    data: { name: "Test Admin", email: "admin@test.local", role: "admin" },
  });
  incident = await prisma.incident.create({
    data: { number: 9001, title: "Checklist test incident", severity: "sev1" },
  });
});

describe("ensureDefaultTemplates", () => {
  it("creates one template per severity with ordered items", async () => {
    await ensureDefaultTemplates();
    const templates = await prisma.checklistTemplate.findMany({ include: { items: true } });
    expect(templates).toHaveLength(4);
    const sev1 = templates.find((t: any) => t.severity === "sev1");
    expect(sev1.items).toHaveLength(DEFAULT_TEMPLATES.sev1.items.length);
    expect(sev1.items.map((i: any) => i.order).sort((a: number, b: number) => a - b)).toEqual(
      DEFAULT_TEMPLATES.sev1.items.map((_: string, i: number) => i + 1),
    );
  });

  it("is idempotent — running twice does not duplicate", async () => {
    await ensureDefaultTemplates();
    await ensureDefaultTemplates();
    expect(await prisma.checklistTemplate.count()).toBe(4);
    expect(await prisma.checklistTemplateItem.count()).toBe(
      Object.values(DEFAULT_TEMPLATES).reduce((n: number, t: any) => n + t.items.length, 0),
    );
  });
});

describe("instantiateChecklist", () => {
  it("copies the severity's template onto the incident and logs an event", async () => {
    await ensureDefaultTemplates();
    const count = await instantiateChecklist(incident.id, "sev1");
    expect(count).toBe(DEFAULT_TEMPLATES.sev1.items.length);

    const items = await prisma.checklistItem.findMany({
      where: { incidentId: incident.id },
      orderBy: { order: "asc" },
    });
    expect(items.map((i: any) => i.text)).toEqual(DEFAULT_TEMPLATES.sev1.items);
    expect(items.every((i: any) => !i.done)).toBe(true);

    const event = await prisma.incidentEvent.findFirst({
      where: { incidentId: incident.id, message: { contains: "Response checklist attached" } },
    });
    expect(event).not.toBeNull();
  });

  it("returns 0 when no template exists for the severity", async () => {
    const count = await instantiateChecklist(incident.id, "sev1");
    expect(count).toBe(0);
    expect(await prisma.checklistItem.count({ where: { incidentId: incident.id } })).toBe(0);
  });
});

describe("toggleChecklistItem", () => {
  async function makeItem() {
    return prisma.checklistItem.create({
      data: { incidentId: incident.id, order: 1, text: "Do the thing" },
    });
  }

  it("marks done with actor + timestamp and drops a timeline event", async () => {
    const item = await makeItem();
    const updated = await toggleChecklistItem(item.id, true, admin.id);
    expect(updated.done).toBe(true);
    expect(updated.doneById).toBe(admin.id);
    expect(updated.doneAt).not.toBeNull();

    const event = await prisma.incidentEvent.findFirst({
      where: { incidentId: incident.id, kind: "checklist" },
    });
    expect(event.message).toContain("Do the thing");
  });

  it("unticking clears done state without adding an event", async () => {
    const item = await makeItem();
    await toggleChecklistItem(item.id, true, admin.id);
    const updated = await toggleChecklistItem(item.id, false, admin.id);
    expect(updated.done).toBe(false);
    expect(updated.doneAt).toBeNull();
    expect(updated.doneById).toBeNull();
    expect(await prisma.incidentEvent.count({ where: { kind: "checklist" } })).toBe(1);
  });

  it("re-ticking an already-done item does not duplicate the event", async () => {
    const item = await makeItem();
    await toggleChecklistItem(item.id, true, admin.id);
    await toggleChecklistItem(item.id, true, admin.id);
    expect(await prisma.incidentEvent.count({ where: { kind: "checklist" } })).toBe(1);
  });

  it("falls back to the admin user when no actor is given", async () => {
    const item = await makeItem();
    const updated = await toggleChecklistItem(item.id, true);
    expect(updated.doneById).toBe(admin.id);
  });
});

describe("checklistProgress", () => {
  it("reports done/total in item order", async () => {
    await prisma.checklistItem.createMany({
      data: [
        { incidentId: incident.id, order: 2, text: "second" },
        { incidentId: incident.id, order: 1, text: "first", done: true, doneById: admin.id, doneAt: new Date() },
      ],
    });
    const progress = await checklistProgress(incident.id);
    expect(progress.total).toBe(2);
    expect(progress.done).toBe(1);
    expect(progress.items[0].text).toBe("first");
  });
});
