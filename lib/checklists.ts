// Response checklists: one editable template per severity. Declaring an
// incident copies the template's items onto the incident; ticking an item
// records who/when and drops an event on the timeline.

import { prisma } from "./db";

export const DEFAULT_TEMPLATES: Record<string, { name: string; items: string[] }> = {
  sev1: {
    name: "SEV1 — full response",
    items: [
      "Confirm on-call has acknowledged the page",
      "Assign Comms Lead and Ops Lead",
      "Publish first status-page update (within 15 min)",
      "Open the incident channel and post the runbook link",
      "Check for a recent deploy — roll back first, investigate second",
      "Notify leadership (SEV1 only)",
      "Publish status updates every 15 minutes",
      "Confirm customer impact has stopped before Monitoring",
    ],
  },
  sev2: {
    name: "SEV2 — standard response",
    items: [
      "Confirm on-call has acknowledged the page",
      "Assign Comms Lead",
      "Publish first status-page update (within 30 min)",
      "Check for a recent deploy or config change",
      "Publish status updates every 30 minutes",
      "Confirm customer impact has stopped before Monitoring",
    ],
  },
  sev3: {
    name: "SEV3 — lightweight response",
    items: [
      "Confirm the right responder owns it",
      "Check dashboards for related symptoms",
      "Decide: fix now or file a follow-up",
    ],
  },
  sev4: {
    name: "SEV4 — track and verify",
    items: [
      "Verify impact is truly minimal",
      "File follow-up if any remediation is needed",
    ],
  },
};

/** Creates any missing per-severity templates (used by seed and tests). */
export async function ensureDefaultTemplates() {
  for (const [severity, t] of Object.entries(DEFAULT_TEMPLATES)) {
    const existing = await prisma.checklistTemplate.findUnique({ where: { severity } });
    if (existing) continue;
    await prisma.checklistTemplate.create({
      data: {
        severity,
        name: t.name,
        items: { create: t.items.map((text, i) => ({ order: i + 1, text })) },
      },
    });
  }
}

/** Copies the severity's template onto the incident. Returns item count. */
export async function instantiateChecklist(incidentId: string, severity: string): Promise<number> {
  const template = await prisma.checklistTemplate.findUnique({
    where: { severity },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!template || template.items.length === 0) return 0;
  await prisma.checklistItem.createMany({
    data: template.items.map((i) => ({ incidentId, order: i.order, text: i.text })),
  });
  await prisma.incidentEvent.create({
    data: {
      incidentId,
      kind: "note",
      message: `Response checklist attached: ${template.name} (${template.items.length} items)`,
    },
  });
  return template.items.length;
}

export async function toggleChecklistItem(itemId: string, done: boolean, actorId?: string) {
  const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id: itemId } });
  const actor = actorId
    ? await prisma.user.findUniqueOrThrow({ where: { id: actorId } })
    : await prisma.user.findFirstOrThrow({ where: { role: "admin" } });
  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: done
      ? { done: true, doneAt: new Date(), doneById: actor.id }
      : { done: false, doneAt: null, doneById: null },
  });
  if (done && !item.done) {
    await prisma.incidentEvent.create({
      data: {
        incidentId: item.incidentId,
        kind: "checklist",
        message: `Checklist: “${item.text}” — done`,
        userId: actor.id,
      },
    });
  }
  return updated;
}

export async function checklistProgress(incidentId: string) {
  const items = await prisma.checklistItem.findMany({
    where: { incidentId },
    orderBy: { order: "asc" },
    include: { doneBy: true },
  });
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length };
}
