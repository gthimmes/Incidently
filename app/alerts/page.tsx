import { prisma } from "@/lib/db";
import { getIngestToken } from "@/lib/alerts";
import AlertsFeed from "./AlertsFeed";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [alerts, token] = await Promise.all([
    prisma.alert.findMany({
      include: { service: true, incident: true },
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
      take: 100,
    }),
    getIngestToken(),
  ]);

  return (
    <AlertsFeed
      token={token}
      alerts={alerts.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        severity: a.severity,
        status: a.status,
        source: a.source,
        count: a.count,
        lastSeenAt: a.lastSeenAt.toISOString(),
        service: a.service ? { name: a.service.name, tier: a.service.tier } : null,
        incident: a.incident ? { id: a.incident.id, number: a.incident.number } : null,
      }))}
    />
  );
}
