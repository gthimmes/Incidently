// SLO / error-budget math.
//
// Availability model: an SLO of 99.9% over 30 days allows
// 30d × 24h × 60m × 0.001 = 43.2 minutes of downtime.
// Downtime is derived from incident durations on the service inside the
// window, weighted by severity: SEV1 counts in full (total outage), SEV2 at
// half (partial impact). SEV3/4 don't burn budget. Open incidents burn up
// to "now". Incidents straddling the window edge count only the inside part.

import { prisma } from "./db";

export interface SloStatus {
  serviceId: string;
  targetPct: number;
  windowDays: number;
  budgetMinutes: number;
  burnedMinutes: number;
  burnPct: number; // 0..∞, >100 means budget blown
  remainingMinutes: number;
  healthy: boolean;
}

const SEVERITY_WEIGHT: Record<string, number> = { sev0: 1, sev1: 1, sev2: 0.5 };

export function computeBurnedMinutes(
  incidents: { severity: string; declaredAt: Date; resolvedAt: Date | null }[],
  windowStart: Date,
  now: Date = new Date(),
): number {
  let burned = 0;
  for (const inc of incidents) {
    const weight = SEVERITY_WEIGHT[inc.severity] ?? 0;
    if (!weight) continue;
    const start = Math.max(inc.declaredAt.getTime(), windowStart.getTime());
    const end = Math.min(inc.resolvedAt?.getTime() ?? now.getTime(), now.getTime());
    if (end <= start) continue;
    burned += ((end - start) / 60_000) * weight;
  }
  return burned;
}

export async function sloStatusForServices(serviceIds: string[]): Promise<Map<string, SloStatus>> {
  const now = new Date();
  const slos = await prisma.slo.findMany({ where: { serviceId: { in: serviceIds } } });
  const result = new Map<string, SloStatus>();

  for (const slo of slos) {
    const windowStart = new Date(now.getTime() - slo.windowDays * 24 * 3600_000);
    const incidents = await prisma.incident.findMany({
      where: {
        serviceId: slo.serviceId,
        severity: { in: ["sev0", "sev1", "sev2"] },
        declaredAt: { lte: now },
        OR: [{ resolvedAt: null }, { resolvedAt: { gte: windowStart } }],
      },
      select: { severity: true, declaredAt: true, resolvedAt: true },
    });

    const budgetMinutes = slo.windowDays * 24 * 60 * (1 - slo.targetPct / 100);
    const burnedMinutes = computeBurnedMinutes(incidents, windowStart, now);
    const burnPct = budgetMinutes > 0 ? (burnedMinutes / budgetMinutes) * 100 : 0;

    result.set(slo.serviceId, {
      serviceId: slo.serviceId,
      targetPct: slo.targetPct,
      windowDays: slo.windowDays,
      budgetMinutes,
      burnedMinutes,
      burnPct,
      remainingMinutes: Math.max(0, budgetMinutes - burnedMinutes),
      healthy: burnPct < 100,
    });
  }
  return result;
}
