// Escalation & paging engine.
//
// When an incident is declared against a service, we walk the service's
// escalation policy: level 1 targets get paged immediately; if a page isn't
// acknowledged within the level's delay window, the next level fires.
// Schedule targets resolve to whoever is on-call right now.

import { prisma } from "./db";
import { pageUser } from "./notify";

/** Who is on call for a schedule at a given moment? */
export async function whoIsOnCall(scheduleId: string, at: Date = new Date()) {
  const shift = await prisma.shift.findFirst({
    where: { scheduleId, startsAt: { lte: at }, endsAt: { gt: at } },
    include: { user: true },
    orderBy: { startsAt: "desc" },
  });
  return shift?.user ?? null;
}

/** Resolve every user targeted by a given escalation level right now. */
async function resolveLevelUsers(levelId: string) {
  const targets = await prisma.escalationTarget.findMany({
    where: { levelId },
    include: { user: true },
  });
  const users = new Map<string, { id: string; name: string }>();
  for (const t of targets) {
    if (t.user) users.set(t.user.id, t.user);
    else if (t.scheduleId) {
      const onCall = await whoIsOnCall(t.scheduleId);
      if (onCall) users.set(onCall.id, onCall);
    }
  }
  return [...users.values()];
}

/** Fire a specific level of the policy for an incident: create pages + notify. */
export async function fireLevel(incidentId: string, levelNumber: number) {
  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: incidentId },
    include: { service: { include: { escalationPolicy: { include: { levels: true } } } } },
  });
  const policy = incident.service?.escalationPolicy;
  if (!policy) return { paged: [] as string[] };

  const level = policy.levels.find((l) => l.levelNumber === levelNumber);
  if (!level) return { paged: [] as string[] };

  const users = await resolveLevelUsers(level.id);
  const pagedNames: string[] = [];

  for (const user of users) {
    const page = await prisma.page.create({
      data: { incidentId, userId: user.id, level: levelNumber },
    });
    await pageUser({
      userId: user.id,
      incidentId,
      pageId: page.id,
      severity: incident.severity,
      incidentNumber: incident.number,
      title: incident.title,
    });
    pagedNames.push(user.name);
  }

  if (pagedNames.length) {
    await prisma.incidentEvent.create({
      data: {
        incidentId,
        kind: "page_sent",
        message: `Paged level ${levelNumber}: ${pagedNames.join(", ")} (SMS · voice · email · push)`,
      },
    });
  }
  return { paged: pagedNames };
}

/**
 * Escalation sweep: find pending pages older than their level's delay and fire
 * the next level. Called opportunistically from API routes (serverless-style
 * cron-less design) and from the manual "Escalate" button.
 */
export async function sweepEscalations() {
  const pending = await prisma.page.findMany({
    where: { status: "pending", incident: { status: { not: "resolved" } } },
    include: {
      incident: {
        include: { service: { include: { escalationPolicy: { include: { levels: true } } } } },
      },
    },
  });

  const escalatedIncidents = new Set<string>();
  for (const page of pending) {
    const policy = page.incident.service?.escalationPolicy;
    if (!policy || escalatedIncidents.has(page.incidentId)) continue;
    const level = policy.levels.find((l) => l.levelNumber === page.level);
    if (!level) continue;

    const deadline = new Date(page.sentAt.getTime() + level.delayMinutes * 60_000);
    if (new Date() < deadline) continue;

    const nextLevel = policy.levels.find((l) => l.levelNumber === page.level + 1);
    if (!nextLevel) continue;

    await prisma.page.update({ where: { id: page.id }, data: { status: "timed_out" } });
    await prisma.incidentEvent.create({
      data: {
        incidentId: page.incidentId,
        kind: "escalated",
        message: `Page to level ${page.level} not acknowledged within ${level.delayMinutes}m — escalating to level ${nextLevel.levelNumber}`,
      },
    });
    await fireLevel(page.incidentId, nextLevel.levelNumber);
    escalatedIncidents.add(page.incidentId);
  }
  return { escalated: escalatedIncidents.size };
}
