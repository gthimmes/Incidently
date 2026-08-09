import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiKey } from "@/lib/apikeys";
import { effectiveServiceStatuses } from "@/lib/maintenance";
import { sloStatusForServices } from "@/lib/slo";

// GET /api/v1/services — catalog with effective status + SLO burn
export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const services = await prisma.service.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] });
  const ids = services.map((s) => s.id);
  const [effective, slos] = await Promise.all([effectiveServiceStatuses(ids), sloStatusForServices(ids)]);

  return NextResponse.json({
    services: services.map((s) => {
      const slo = slos.get(s.id);
      return {
        slug: s.slug,
        name: s.name,
        tier: s.tier,
        status: effective.get(s.id)?.effectiveStatus ?? s.status,
        slo: slo
          ? {
              target_pct: slo.targetPct,
              window_days: slo.windowDays,
              budget_minutes: Math.round(slo.budgetMinutes),
              burned_minutes: Math.round(slo.burnedMinutes),
              burn_pct: Math.round(slo.burnPct),
              healthy: slo.healthy,
            }
          : null,
      };
    }),
  });
}
