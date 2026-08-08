import { NextRequest, NextResponse } from "next/server";
import { ingestAlert } from "@/lib/alerts";

// Demo helper: fire a realistic sample alert through the real ingestion
// pipeline (dedup and promotion rules included), as if a monitoring tool
// had POSTed it to /api/ingest.
const SAMPLES = {
  warning: [
    {
      title: "P95 latency above 800ms on search queries",
      description: "Rolling 5m P95 at 812ms (threshold 800ms). May self-recover.",
      severity: "warning" as const,
      service: "search",
      source: "grafana",
      dedup_key: "search-p95-latency",
    },
    {
      title: "Disk usage 82% on notification worker",
      description: "Volume /var/lib/queue at 82% (warn at 80%).",
      severity: "warning" as const,
      service: "notifications",
      source: "cloudwatch",
      dedup_key: "notif-disk-82",
    },
  ],
  critical: [
    {
      title: "Checkout error rate above 5% (SLO burn)",
      description: "5xx rate at 7.4% over 5m against the 99.9% availability SLO.",
      severity: "critical" as const,
      service: "payments",
      source: "datadog",
      dedup_key: "payments-checkout-5xx",
    },
    {
      title: "API gateway health checks failing in us-east-1",
      description: "3/9 gateway instances failing readiness checks.",
      severity: "critical" as const,
      service: "public-api",
      source: "grafana",
      dedup_key: "api-gw-health",
    },
  ],
};

export async function POST(req: NextRequest) {
  const { kind } = await req.json().catch(() => ({ kind: "warning" }));
  const pool = kind === "critical" ? SAMPLES.critical : SAMPLES.warning;
  const sample = pool[Math.floor(Math.random() * pool.length)];
  const result = await ingestAlert({ ...sample, source: "test" });
  return NextResponse.json(result);
}
