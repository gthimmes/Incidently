import Link from "next/link";
import { prisma } from "@/lib/db";
import { ServiceStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Tier 1 · Critical", color: "#ef4444" },
  2: { label: "Tier 2 · Important", color: "#eab308" },
  3: { label: "Tier 3 · Supporting", color: "#64748b" },
};

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    include: {
      escalationPolicy: true,
      incidents: { where: { status: { not: "resolved" } } },
      _count: { select: { incidents: true } },
    },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-5 animate-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-dim text-sm mt-0.5">
          The service catalog — each service maps to an escalation policy so declaring an incident pages the right team instantly.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-5">
        {services.map((s) => {
          const tier = TIER_LABELS[s.tier] ?? TIER_LABELS[3];
          return (
            <div key={s.id} className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">{s.name}</h2>
                <ServiceStatusBadge status={s.status} />
              </div>
              <p className="text-dim text-sm">{s.description}</p>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span
                  className="px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${tier.color}15`, color: tier.color }}
                >
                  {tier.label}
                </span>
                {s.escalationPolicy && (
                  <span className="text-dim">
                    Escalation: <Link href="/oncall" className="text-accent hover:underline">{s.escalationPolicy.name}</Link>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm pt-1 border-t border-line">
                <span className={s.incidents.length ? "text-red-400 font-medium" : "text-dim"}>
                  {s.incidents.length} active incident{s.incidents.length === 1 ? "" : "s"}
                </span>
                <span className="text-dim">{s._count.incidents} all-time</span>
                {s.incidents.length > 0 && (
                  <Link href={`/incidents/${s.incidents[0].id}`} className="text-accent hover:underline ml-auto text-xs">
                    View active →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
