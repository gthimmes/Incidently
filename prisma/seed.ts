/* Seed: realistic demo data — users, services, schedules, escalation
   policies, historical incidents with postmortems, and one live incident. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.now();

async function main() {
  // wipe (order matters for FKs)
  await prisma.alert.deleteMany();
  await prisma.runbook.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.page.deleteMany();
  await prisma.jiraLink.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.postmortem.deleteMany();
  await prisma.statusUpdate.deleteMany();
  await prisma.incidentEvent.deleteMany();
  await prisma.incidentRole.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.escalationTarget.deleteMany();
  await prisma.escalationLevel.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.service.deleteMany();
  await prisma.escalationPolicy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  // ── Users ──
  const [glenn, maya, dev, sarah, james, priya] = await Promise.all([
    prisma.user.create({ data: { name: "Glenn Thimmes", email: "glenn.thimmes@aiwyn.ai", phone: "+15555550100", role: "admin", avatarColor: "#6366f1" } }),
    prisma.user.create({ data: { name: "Maya Rodriguez", email: "maya@aiwyn.ai", phone: "+15555550101", avatarColor: "#ec4899" } }),
    prisma.user.create({ data: { name: "Dev Patel", email: "dev@aiwyn.ai", phone: "+15555550102", avatarColor: "#14b8a6" } }),
    prisma.user.create({ data: { name: "Sarah Chen", email: "sarah@aiwyn.ai", phone: "+15555550103", avatarColor: "#f59e0b" } }),
    prisma.user.create({ data: { name: "James Okafor", email: "james@aiwyn.ai", phone: "+15555550104", avatarColor: "#8b5cf6" } }),
    prisma.user.create({ data: { name: "Priya Sharma", email: "priya@aiwyn.ai", phone: "+15555550105", avatarColor: "#06b6d4" } }),
  ]);
  const team = [glenn, maya, dev, sarah, james, priya];

  // ── Schedules (weekly rotation, seeded ±4 weeks around now) ──
  const primarySchedule = await prisma.schedule.create({
    data: { name: "Platform Primary", description: "First responder rotation for platform services", rotationDays: 7 },
  });
  const secondarySchedule = await prisma.schedule.create({
    data: { name: "Platform Secondary", description: "Backup rotation — catches unacked pages", rotationDays: 7 },
  });
  const primaryRotation = [maya, dev, sarah, james];
  const secondaryRotation = [glenn, priya];
  for (let w = -4; w <= 4; w++) {
    const start = new Date(now + w * 7 * DAY - 2 * DAY);
    const end = new Date(start.getTime() + 7 * DAY);
    await prisma.shift.create({
      data: { scheduleId: primarySchedule.id, userId: primaryRotation[((w % 4) + 4) % 4].id, startsAt: start, endsAt: end },
    });
    await prisma.shift.create({
      data: { scheduleId: secondarySchedule.id, userId: secondaryRotation[((w % 2) + 2) % 2].id, startsAt: start, endsAt: end },
    });
  }

  // ── Escalation policy ──
  const policy = await prisma.escalationPolicy.create({
    data: { name: "Platform Standard", description: "Primary on-call → secondary → engineering leadership", repeatCount: 2 },
  });
  const l1 = await prisma.escalationLevel.create({ data: { policyId: policy.id, levelNumber: 1, delayMinutes: 5 } });
  const l2 = await prisma.escalationLevel.create({ data: { policyId: policy.id, levelNumber: 2, delayMinutes: 10 } });
  const l3 = await prisma.escalationLevel.create({ data: { policyId: policy.id, levelNumber: 3, delayMinutes: 15 } });
  await prisma.escalationTarget.create({ data: { levelId: l1.id, scheduleId: primarySchedule.id } });
  await prisma.escalationTarget.create({ data: { levelId: l2.id, scheduleId: secondarySchedule.id } });
  await prisma.escalationTarget.create({ data: { levelId: l3.id, userId: glenn.id } });

  // ── Services ──
  const mkService = (name: string, slug: string, tier: number, description: string, status = "operational") =>
    prisma.service.create({ data: { name, slug, tier, description, status, escalationPolicyId: policy.id } });
  const api = await mkService("Public API", "public-api", 1, "Customer-facing REST & GraphQL API");
  const payments = await mkService("Payments Pipeline", "payments", 1, "Billing, invoicing and payment processing");
  const webapp = await mkService("Web Application", "web-app", 1, "Main customer web application");
  const search = await mkService("Search & Indexing", "search", 2, "Full-text search and background indexing");
  const notifications = await mkService("Notification Service", "notifications", 2, "Email/SMS delivery to customers");
  const internal = await mkService("Internal Tooling", "internal-tools", 3, "Admin dashboards and internal tools");

  // ── Historical incidents (resolved, with postmortems & remediations) ──
  let n = 1000;

  async function historicalIncident(opts: {
    title: string; summary: string; severity: string; serviceId: string;
    daysAgo: number; durationMin: number; ackMin: number; mitigateMin: number;
    commander: typeof glenn; ops: typeof glenn; comms: typeof glenn;
    rootCause: string; impact: string;
    actionItems: { title: string; status: string; priority: string; assignee: typeof glenn; jiraKey?: string }[];
    pmStatus?: string;
  }) {
    n += 1;
    const declaredAt = new Date(now - opts.daysAgo * DAY);
    const resolvedAt = new Date(declaredAt.getTime() + opts.durationMin * 60_000);
    const inc = await prisma.incident.create({
      data: {
        number: n, title: opts.title, summary: opts.summary, severity: opts.severity,
        status: "resolved", serviceId: opts.serviceId, declaredAt,
        acknowledgedAt: new Date(declaredAt.getTime() + opts.ackMin * 60_000),
        mitigatedAt: new Date(declaredAt.getTime() + opts.mitigateMin * 60_000),
        resolvedAt, slackChannel: `#inc-${n}-${opts.title.toLowerCase().split(" ").slice(0, 3).join("-").replace(/[^a-z-]/g, "")}`,
      },
    });
    await prisma.incidentRole.createMany({
      data: [
        { incidentId: inc.id, role: "commander", userId: opts.commander.id },
        { incidentId: inc.id, role: "ops", userId: opts.ops.id },
        { incidentId: inc.id, role: "comms", userId: opts.comms.id },
      ],
    });
    const ev = (kind: string, message: string, minOffset: number, userId?: string) =>
      prisma.incidentEvent.create({ data: { incidentId: inc.id, kind, message, userId, createdAt: new Date(declaredAt.getTime() + minOffset * 60_000) } });
    await ev("declared", `Incident declared (${opts.severity.toUpperCase()}) by ${opts.commander.name}`, 0, opts.commander.id);
    await ev("page_sent", "Paged level 1 via SMS, voice, email, push", 0);
    await ev("page_acked", `${opts.ops.name} acknowledged the page`, opts.ackMin, opts.ops.id);
    await ev("status_change", "Status changed: triage → investigating", opts.ackMin + 2, opts.commander.id);
    await ev("note", "Initial investigation started; checking dashboards and recent deploys", opts.ackMin + 5, opts.ops.id);
    await ev("status_change", "Status changed: investigating → identified", Math.round(opts.mitigateMin * 0.7), opts.ops.id);
    await ev("status_change", "Status changed: identified → monitoring", opts.mitigateMin, opts.commander.id);
    await ev("resolved", "Incident resolved", opts.durationMin, opts.commander.id);

    await prisma.statusUpdate.create({
      data: { incidentId: inc.id, body: `We are investigating ${opts.summary.toLowerCase()}`, status: "investigating", authorId: opts.comms.id, createdAt: new Date(declaredAt.getTime() + (opts.ackMin + 4) * 60_000) },
    });
    await prisma.statusUpdate.create({
      data: { incidentId: inc.id, body: "A fix has been applied and we are monitoring recovery.", status: "monitoring", authorId: opts.comms.id, createdAt: new Date(declaredAt.getTime() + opts.mitigateMin * 60_000) },
    });
    await prisma.statusUpdate.create({
      data: { incidentId: inc.id, body: "This incident has been resolved. Full service restored.", status: "resolved", authorId: opts.comms.id, createdAt: resolvedAt },
    });

    await prisma.postmortem.create({
      data: {
        incidentId: inc.id, status: opts.pmStatus ?? "published",
        summary: opts.summary, impact: opts.impact, rootCause: opts.rootCause,
        whatWentWell: "Fast acknowledgment by on-call. Clear comms cadence kept stakeholders informed.",
        whatWentPoorly: "Detection relied on customer reports before internal alerting fired.",
        whereWeGotLucky: "Incident occurred during business hours with full team availability.",
        timelineNotes: "See incident timeline for the full event-by-event record.",
      },
    });

    for (const ai of opts.actionItems) {
      const item = await prisma.actionItem.create({
        data: {
          incidentId: inc.id, title: ai.title, status: ai.status, priority: ai.priority,
          assigneeId: ai.assignee.id, kind: "remediation",
          dueAt: new Date(now + (7 + Math.floor(Math.random() * 21)) * DAY),
        },
      });
      if (ai.jiraKey) {
        await prisma.jiraLink.create({
          data: { issueKey: ai.jiraKey, issueUrl: `https://mock.atlassian.net/browse/${ai.jiraKey}`, issueSummary: ai.title, issueStatus: ai.status === "done" ? "Done" : "In Progress", actionItemId: item.id, incidentId: inc.id },
        });
      }
    }
    return inc;
  }

  await historicalIncident({
    title: "Database connection pool exhaustion on Public API",
    summary: "API error rates spiked to 40% due to exhausted DB connection pool",
    severity: "sev1", serviceId: api.id, daysAgo: 42, durationMin: 187, ackMin: 3, mitigateMin: 95,
    commander: glenn, ops: dev, comms: maya,
    rootCause: "A slow query introduced in release 24.7 held connections open far longer than expected under peak load, exhausting the pool. Pool size had no headroom and no alerting on saturation.",
    impact: "~40% of API requests failed for 95 minutes. Approximately 1,200 customers saw errors.",
    actionItems: [
      { title: "Add alerting on DB pool saturation > 80%", status: "done", priority: "high", assignee: dev, jiraKey: "OPS-87" },
      { title: "Add query performance regression check to CI", status: "in_progress", priority: "high", assignee: sarah, jiraKey: "OPS-88" },
      { title: "Increase pool headroom and document sizing policy", status: "done", priority: "medium", assignee: dev },
    ],
  });

  await historicalIncident({
    title: "Payment webhooks delayed 45+ minutes",
    summary: "Queue backlog delayed payment confirmation webhooks to merchants",
    severity: "sev2", serviceId: payments.id, daysAgo: 30, durationMin: 124, ackMin: 6, mitigateMin: 60,
    commander: maya, ops: james, comms: sarah,
    rootCause: "A consumer deployment with a config typo pointed workers at the wrong queue partition, causing consumption to silently stop while producers continued.",
    impact: "Payment confirmations delayed up to 45 minutes for all merchants; no data loss.",
    actionItems: [
      { title: "Validate queue config at worker startup, crash loudly on mismatch", status: "done", priority: "high", assignee: james, jiraKey: "OPS-91" },
      { title: "Alert on consumer lag > 5 min", status: "done", priority: "high", assignee: james, jiraKey: "OPS-92" },
    ],
  });

  await historicalIncident({
    title: "Search indexing pipeline stalled",
    summary: "New documents not appearing in search results for several hours",
    severity: "sev3", serviceId: search.id, daysAgo: 21, durationMin: 310, ackMin: 12, mitigateMin: 240,
    commander: dev, ops: priya, comms: maya,
    rootCause: "Index writer hit a mapping conflict on a new field type and entered a retry loop without surfacing errors.",
    impact: "Search results stale for ~5 hours. Minimal customer reports.",
    actionItems: [
      { title: "Surface indexing errors to on-call dashboard", status: "in_progress", priority: "medium", assignee: priya, jiraKey: "OPS-95" },
      { title: "Add staleness monitor for search index lag", status: "open", priority: "medium", assignee: dev },
    ],
    pmStatus: "in_review",
  });

  await historicalIncident({
    title: "TLS certificate expiry on notification sender",
    summary: "Customer email delivery failing due to expired TLS certificate",
    severity: "sev2", serviceId: notifications.id, daysAgo: 14, durationMin: 78, ackMin: 4, mitigateMin: 45,
    commander: sarah, ops: maya, comms: glenn,
    rootCause: "Auto-renewal job for the SMTP relay cert had been failing silently for 3 weeks; the failure alert was routed to a deprecated Slack channel.",
    impact: "Outbound customer email failed for ~75 minutes (≈8,400 messages queued, all delivered after fix).",
    actionItems: [
      { title: "Route cert renewal failures to on-call, not Slack", status: "done", priority: "high", assignee: maya, jiraKey: "OPS-99" },
      { title: "Add cert expiry monitoring (30/14/7 day warnings)", status: "in_progress", priority: "high", assignee: sarah, jiraKey: "OPS-101" },
    ],
  });

  await historicalIncident({
    title: "Web app slow page loads after CDN change",
    summary: "P95 page load times tripled following CDN configuration rollout",
    severity: "sev3", serviceId: webapp.id, daysAgo: 7, durationMin: 92, ackMin: 8, mitigateMin: 55,
    commander: james, ops: sarah, comms: priya,
    rootCause: "New CDN cache policy accidentally set no-store on static assets, forcing origin fetches for every request.",
    impact: "P95 load time went from 1.2s to 3.8s for ~90 minutes. No errors, degraded experience only.",
    actionItems: [
      { title: "Add synthetic performance checks to CDN config pipeline", status: "open", priority: "medium", assignee: sarah, jiraKey: "OPS-104" },
    ],
    pmStatus: "draft",
  });

  // ── One live incident for the demo ──
  n += 1;
  const liveDeclared = new Date(now - 23 * 60_000);
  const live = await prisma.incident.create({
    data: {
      number: n,
      title: "Elevated error rates on Payments Pipeline",
      summary: "Checkout failures reported; payment provider API returning intermittent 502s",
      severity: "sev2", status: "investigating", serviceId: payments.id,
      declaredAt: liveDeclared, acknowledgedAt: new Date(liveDeclared.getTime() + 2 * 60_000),
      slackChannel: `#inc-${n}-payments-errors`,
    },
  });
  await prisma.incidentRole.createMany({
    data: [
      { incidentId: live.id, role: "commander", userId: maya.id },
      { incidentId: live.id, role: "ops", userId: james.id },
    ],
  });
  const lev = (kind: string, message: string, minOffset: number, userId?: string) =>
    prisma.incidentEvent.create({ data: { incidentId: live.id, kind, message, userId, createdAt: new Date(liveDeclared.getTime() + minOffset * 60_000) } });
  await lev("declared", "Incident declared (SEV2) by Maya Rodriguez", 0, maya.id);
  await lev("page_sent", "Paged level 1: James Okafor (SMS · voice · email · push)", 0);
  await lev("page_acked", "James Okafor acknowledged the page", 2, james.id);
  await lev("status_change", "Status changed: triage → investigating", 3, maya.id);
  await lev("note", "Error rate at 8% on checkout API. Provider status page shows no incident — investigating our integration layer.", 9, james.id);
  await lev("note", "Retries with exponential backoff are absorbing some failures. Considering circuit breaker activation.", 17, james.id);

  const livePage = await prisma.page.create({
    data: { incidentId: live.id, userId: james.id, level: 1, status: "acknowledged", sentAt: liveDeclared, ackedAt: new Date(liveDeclared.getTime() + 2 * 60_000) },
  });
  // simulated notification deliveries for the live page
  const notif = (channel: string, recipient: string, offsetMin: number) =>
    prisma.notification.create({
      data: {
        channel, recipient,
        body: `[Incidently] SEV2 INC-${n}: Elevated error rates on Payments Pipeline. You are being paged — acknowledge in the app.`,
        status: "simulated", provider: "simulator", userId: james.id, incidentId: live.id, pageId: livePage.id,
        createdAt: new Date(liveDeclared.getTime() + offsetMin * 60_000),
      },
    });
  await notif("sms", "+15555550104", 0);
  await notif("voice", "+15555550104", 0);
  await notif("email", "james@aiwyn.ai", 0);
  await notif("push", "james@aiwyn.ai", 0);

  await prisma.statusUpdate.create({
    data: { incidentId: live.id, body: "We are investigating elevated error rates affecting checkout. Payments may intermittently fail — retries are recommended.", status: "investigating", authorId: maya.id, createdAt: new Date(liveDeclared.getTime() + 8 * 60_000) },
  });

  await prisma.service.update({ where: { id: payments.id }, data: { status: "degraded" } });

  // Jira settings default (mock mode on)
  await prisma.setting.create({
    data: { key: "jira", value: JSON.stringify({ baseUrl: "", email: "", apiToken: "", projectKey: "OPS", mockMode: true }) },
  });
  await prisma.setting.create({ data: { key: "jira_mock_counter", value: "110" } });
  await prisma.setting.create({ data: { key: "incident_counter", value: String(n) } });

  // ── Runbooks ──
  await prisma.runbook.create({
    data: {
      title: "Payments Pipeline: elevated error rates",
      serviceId: payments.id,
      content: `# Payments error-rate response

## Symptoms
- Checkout 5xx rate above 2% on the \`payments-checkout\` dashboard
- Merchant webhook delays

## First 10 minutes
1. Check the provider status page and \`payments-provider-health\` dashboard
2. Check recent deploys: \`deployctl list payments --since 2h\`
3. If a deploy correlates, **roll back first, investigate second**
4. Activate the circuit breaker if provider 502s exceed 10%: \`payments-cli breaker on\`

## Escalation
- Provider-side issue → open a P1 with the provider, update status page
- Our integration layer → page the payments secondary via **Escalate**`,
    },
  });
  await prisma.runbook.create({
    data: {
      title: "Public API: gateway 5xx / health-check failures",
      serviceId: api.id,
      content: `# Gateway 5xx response

## Symptoms
- LB health checks flapping, 503s at the edge

## Steps
1. \`kubectl get pods -n gateway\` — look for crash loops
2. Diff the last config deploy: \`gateway-cli config diff HEAD~1\`
3. Bad config → \`gateway-cli config rollback\` (takes ~90s to propagate)
4. Verify: error rate on \`api-edge\` dashboard back under 0.5%

## Notes
- Config-only deploys skip the canary — treat every config change as suspect first`,
    },
  });
  await prisma.runbook.create({
    data: {
      title: "General: comms cadence during SEV1/SEV2",
      content: `# Comms cadence

- SEV1: status-page update every **15 minutes**, even if "still investigating"
- SEV2: every 30 minutes
- Use plain language: what customers see, what we're doing, when we'll update next
- Never promise an ETA you haven't verified with the ops lead`,
    },
  });

  // ── Alerts ──
  await prisma.alert.create({
    data: {
      title: "P95 latency above 800ms on search queries",
      description: "Rolling 5m P95 at 843ms (threshold 800ms).",
      severity: "warning", source: "grafana", dedupKey: "search-p95-latency",
      serviceId: search.id, count: 3,
      firstSeenAt: new Date(now - 52 * 60_000), lastSeenAt: new Date(now - 4 * 60_000),
    },
  });
  await prisma.alert.create({
    data: {
      title: "Payment provider webhook latency degraded",
      description: "Webhook round-trip P50 at 2.1s (baseline 300ms).",
      severity: "warning", source: "datadog", dedupKey: "payments-webhook-latency",
      serviceId: payments.id, incidentId: live.id, count: 7,
      firstSeenAt: new Date(now - 25 * 60_000), lastSeenAt: new Date(now - 2 * 60_000),
    },
  });
  await prisma.alert.create({
    data: {
      title: "Certificate expiring in 14 days: smtp-relay.aiwyn.ai",
      description: "Renew before 2026-08-20 to avoid delivery failure.",
      severity: "info", source: "cloudwatch", dedupKey: "cert-smtp-relay",
      serviceId: notifications.id,
      firstSeenAt: new Date(now - 6 * 3600_000), lastSeenAt: new Date(now - 6 * 3600_000),
    },
  });
  await prisma.alert.create({
    data: {
      title: "Disk usage 85% on indexing worker",
      severity: "warning", source: "cloudwatch", dedupKey: "indexer-disk",
      serviceId: search.id, status: "resolved", count: 2,
      firstSeenAt: new Date(now - 2 * DAY), lastSeenAt: new Date(now - 2 * DAY + 3600_000),
      resolvedAt: new Date(now - 2 * DAY + 2 * 3600_000),
    },
  });

  console.log(`Seeded: ${team.length} users, 6 services, ${n - 1000} incidents (1 live), 3 runbooks, 4 alerts`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
