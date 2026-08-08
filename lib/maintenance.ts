// Maintenance windows.
//
// Scheduling a window advertises it on the status page. While a window is
// active the service reports "maintenance" (unless it is already in a worse,
// incident-driven state). Effective status is computed at read time, so
// windows start and end with no ticker involvement.

import { prisma } from "./db";

export interface ServiceWithStatus {
  id: string;
  effectiveStatus: string;
  activeWindow: { id: string; title: string; endsAt: Date } | null;
}

const INCIDENT_STATES = new Set(["degraded", "partial_outage", "major_outage"]);

/** Effective status for a set of services, folding in active maintenance. */
export async function effectiveServiceStatuses(
  serviceIds: string[],
  at: Date = new Date(),
): Promise<Map<string, ServiceWithStatus>> {
  const [services, windows] = await Promise.all([
    prisma.service.findMany({ where: { id: { in: serviceIds } } }),
    prisma.maintenanceWindow.findMany({
      where: {
        serviceId: { in: serviceIds },
        cancelled: false,
        startsAt: { lte: at },
        endsAt: { gt: at },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const byService = new Map<string, ServiceWithStatus>();
  for (const s of services) {
    const win = windows.find((w) => w.serviceId === s.id) ?? null;
    // an incident-driven state always outranks planned maintenance
    const effectiveStatus = win && !INCIDENT_STATES.has(s.status) ? "maintenance" : s.status;
    byService.set(s.id, {
      id: s.id,
      effectiveStatus,
      activeWindow: win ? { id: win.id, title: win.title, endsAt: win.endsAt } : null,
    });
  }
  return byService;
}

export async function upcomingWindows(withinDays = 14) {
  const now = new Date();
  return prisma.maintenanceWindow.findMany({
    where: {
      cancelled: false,
      endsAt: { gt: now },
      startsAt: { lt: new Date(now.getTime() + withinDays * 24 * 3600_000) },
    },
    include: { service: true },
    orderBy: { startsAt: "asc" },
  });
}
