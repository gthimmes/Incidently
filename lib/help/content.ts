import type { HelpContent } from "help-navigator";

// The in-app help corpus. Plain data: categories + markdown articles.
// Rendered by the help-navigator widget mounted in app/layout.tsx.
export const helpContent: HelpContent = {
  categories: [
    {
      id: "getting-started",
      title: "Getting started",
      icon: "🚀",
      description: "What Incidently is and how a response flows end to end.",
    },
    {
      id: "incidents",
      title: "Incidents",
      icon: "🚨",
      description: "Declaring, running, and resolving incidents.",
    },
    {
      id: "oncall",
      title: "On-call & escalation",
      icon: "📟",
      description: "Rotations, escalation policies, overrides, and paging.",
    },
    {
      id: "alerts",
      title: "Alerts & ingestion",
      icon: "📡",
      description: "Webhook ingestion, dedup, and promotion rules.",
    },
    {
      id: "learning",
      title: "Postmortems & remediations",
      icon: "📖",
      description: "Blameless postmortems and tracking fixes to done.",
    },
    {
      id: "platform",
      title: "Services, runbooks & status",
      icon: "🧭",
      description: "Service catalog, runbooks, maintenance, and the status page.",
    },
    {
      id: "admin",
      title: "Settings & integrations",
      icon: "⚙️",
      description: "Notifications, Jira, API keys, and outbound webhooks.",
    },
  ],
  articles: [
    // ---------- Getting started ----------
    {
      id: "welcome",
      title: "Incidently in five minutes",
      category: "getting-started",
      featured: true,
      tags: ["overview", "tour", "basics"],
      body: `Incidently is your team's incident response hub: **declare, respond, learn.**

## The response loop

1. **Declare** an incident (or let an alert promote itself) — on-call is paged instantly
2. **Respond** in the incident room: statuses, roles, timeline, status updates
3. **Resolve** — SEV0–SEV2 incidents auto-create a postmortem
4. **Learn** — publish the postmortem and track remediations to done

## Where things live

- **Dashboard** — open incidents, on-call now, recent activity
- **Incidents** — every incident, past and present
- **Alerts** — the raw feed from your monitoring tools
- **On-Call** — rotations, escalation policies, overrides

> Press **F1** anytime to open this help panel, or **Ctrl+K** for the command palette.`,
      related: ["declare-incident", "incident-room", "oncall-overview"],
    },
    {
      id: "dashboard",
      title: "Reading the dashboard",
      category: "getting-started",
      tags: ["dashboard", "overview"],
      body: `The dashboard is the at-a-glance state of your world:

- **Open incidents** with severity, status, and elapsed time
- **Who is on call right now** across every rotation
- **Recent activity** so you can catch up after being away

Everything links through — click an incident to enter its room, a rotation to see its schedule.

If the board is empty, that's the goal. Enjoy it while it lasts.`,
      related: ["welcome", "declare-incident"],
    },
    {
      id: "command-palette",
      title: "Keyboard shortcuts & command palette",
      category: "getting-started",
      tags: ["shortcuts", "keyboard", "productivity"],
      body: `- **Ctrl+K** (or **Cmd+K**) — open the command palette: jump to any page, incident, or runbook by typing
- **F1** — toggle this help panel
- **Esc** — close panels and dialogs

The command palette searches incidents, services, and runbooks in one box — fastest way to move during a live incident.`,
    },

    // ---------- Incidents ----------
    {
      id: "declare-incident",
      title: "Declaring an incident",
      category: "incidents",
      featured: true,
      tags: ["declare", "sev1", "severity", "page"],
      body: `Click the red **Declare Incident** button (always in the sidebar) when something is wrong.

## What you fill in

- **Summary** — one line, plain language: *"Elevated error rates on checkout"*
- **Severity** — SEV0 (existential, all hands) to SEV4 (minor)
- **Affected service** — picks who gets paged and which runbooks surface

## What happens the moment you declare

1. Level 1 of the service's escalation policy is **paged instantly** across their notification channels
2. A dedicated incident room opens with a live timeline
3. Runbooks for the affected service are surfaced in the room

> When in doubt, declare. A SEV4 that turns out to be nothing costs minutes; a real incident nobody declared costs hours.`,
      related: ["severity-levels", "incident-room", "escalation-policies"],
    },
    {
      id: "severity-levels",
      title: "Choosing a severity (SEV0–SEV4)",
      category: "incidents",
      tags: ["severity", "sev0", "sev1", "sev2", "triage"],
      body: `Severity decides who gets woken up and how:

- **SEV0** — existential, company-wide outage. Everything SEV1 does, plus the all-hands checklist: war room, executive notification, legal/regulatory check. Reserved for a human's judgment — alerts never auto-promote this far
- **SEV1** — critical outage, customers can't use the product. SMS **and** voice call, auto-postmortem on resolve
- **SEV2** — major degradation or a tier-1 service impaired. SMS + voice, auto-postmortem
- **SEV3** — partial or degraded functionality, workaround exists. Standard channels
- **SEV4** — minor issue, cosmetic, or precautionary. Standard channels

Severity can be changed later from the incident room, so pick your best guess and move on. Escalating a SEV3 to SEV1 mid-incident is normal, not a failure.`,
      related: ["declare-incident", "postmortem-basics"],
    },
    {
      id: "incident-room",
      title: "Working the incident room",
      category: "incidents",
      featured: true,
      tags: ["timeline", "status", "workflow", "notes"],
      body: `Every incident gets a dedicated room — the single place the response happens.

## Status stepper

Walk the incident through **Triage → Investigating → Identified → Monitoring → Resolved** with one click per step. Each change lands on the timeline with a timestamp.

## The live timeline

Every event is captured automatically: declaration, pages sent, acknowledgments, status changes, escalations, notes. Add your own notes for anything the system can't see — *"rolled back deploy 4c1f"*.

## Also in the room

- **Roles** — assign Commander, Comms, Ops, Scribe
- **Status updates** — publish to stakeholders and the public status page
- **Runbooks** for the affected service
- **Action items** — capture remediations as you spot them
- **Escalate** button — page the next level when you need more hands

Key timestamps (declared / acknowledged / mitigated / resolved) are tracked automatically and feed Analytics.`,
      related: ["response-roles", "status-updates", "escalation-policies"],
    },
    {
      id: "response-roles",
      title: "Response roles: Commander, Comms, Ops, Scribe",
      category: "incidents",
      tags: ["roles", "commander", "comms"],
      body: `Assign roles from the incident room so nobody wonders who's doing what:

- **Incident Commander** — owns the response, makes the calls, keeps everyone unblocked. Not necessarily the person typing the fix.
- **Comms Lead** — publishes status updates, shields responders from "any update?" pings
- **Ops Lead** — hands on keyboard, drives the technical investigation
- **Scribe** — keeps the timeline honest with notes as things happen

For small incidents one person may wear every hat. For a SEV1, fill Commander and Comms first — coordination and communication fail before technology does.`,
      related: ["incident-room", "status-updates"],
    },
    {
      id: "status-updates",
      title: "Publishing status updates",
      category: "incidents",
      tags: ["stakeholders", "status-page", "communication"],
      body: `Status updates go to stakeholders and (for public-facing incidents) the status page — from the **Updates** panel in the incident room.

## What a good update looks like

- What's impacted, in customer language
- What we know and what we're doing
- When the next update will come

*"Checkout errors for ~20% of users since 14:05 UTC. We've identified a bad deploy and are rolling back. Next update in 20 minutes."*

Cadence beats completeness: a short update every 20–30 minutes during a SEV1/SEV2 keeps everyone out of your incident room.`,
      related: ["incident-room", "status-page", "response-roles"],
    },
    {
      id: "resolving-incidents",
      title: "Resolving an incident (and what happens next)",
      category: "incidents",
      tags: ["resolve", "monitoring", "postmortem"],
      body: `Move to **Monitoring** once a fix is in and you're watching it hold, then **Resolved** when you're confident.

On resolve:

- The resolved timestamp locks in, completing the incident's analytics record
- **SEV0–SEV2 incidents auto-create a postmortem** in Draft, with the timeline already embedded
- Open action items stay live on the Remediations board — resolving the incident does not close its follow-ups

Resolved too early? Reopen by stepping the status back — the timeline records that too, blamelessly.`,
      related: ["postmortem-basics", "remediations-board"],
    },

    // ---------- On-call & escalation ----------
    {
      id: "oncall-overview",
      title: "How on-call works in Incidently",
      category: "oncall",
      featured: true,
      tags: ["rotation", "schedule", "shifts"],
      body: `The **On-Call** page shows every rotation with a visual shift timeline and an **on call now** indicator.

## Rotations

A rotation is an ordered list of people taking turns on a schedule. The timeline shows exactly who owns which hours — no spreadsheet archaeology.

## How paging finds a human

When an incident is declared, the affected service's **escalation policy** fires level 1. A level targets either a rotation (pages whoever is on call now) or specific users.

If nobody acknowledges within the level's timeout, the next level fires automatically — see *Escalation policies & auto-escalation* below for the mechanics.`,
      related: ["escalation-policies", "oncall-overrides", "notification-channels"],
    },
    {
      id: "escalation-policies",
      title: "Escalation policies & auto-escalation",
      category: "oncall",
      tags: ["escalation", "ack", "timeout", "paging"],
      body: `An escalation policy is a ladder of levels, each with an **ack timeout**.

## The ladder

1. Level 1 is paged the moment an incident is declared
2. No acknowledgment within the timeout → level 2 is paged automatically
3. …and so on, until someone acks

A background sweeper checks every 60 seconds for unacknowledged pages past their deadline — auto-escalation happens even if every browser tab is closed.

## Manual escalation

Need more hands even though someone acked? The **Escalate** button in the incident room fires the next level immediately.

**Acknowledge fast, even before you start investigating** — an ack tells the system a human owns it and stops the ladder.`,
      related: ["oncall-overview", "incident-room", "notification-channels"],
    },
    {
      id: "oncall-overrides",
      title: "On-call overrides: taking someone's shift",
      category: "oncall",
      tags: ["override", "swap", "shift"],
      body: `Someone's sick, traveling, or you owe them one — use an **override** instead of editing the rotation.

On the On-Call page, click **Override** on a rotation and pick who covers and until when. Paging follows the override for its duration, then the normal rotation resumes untouched.

Overrides are logged, so "who was actually on call at 03:00?" always has a true answer.`,
      related: ["oncall-overview"],
    },
    {
      id: "notification-channels",
      title: "How pages reach you (SMS, voice, email, push)",
      category: "oncall",
      tags: ["sms", "voice", "notifications", "twilio"],
      body: `Every page fans out across channels — and severity changes the mix:

- **SEV0 / SEV1 / SEV2** — SMS **and** a voice call, plus email and push. Hard to sleep through, by design.
- **SEV3 / SEV4** — standard channels

## Simulation mode (the default)

Out of the box, nothing costs money and nothing needs configuring: every message is recorded to the **Notifications** feed exactly as it would have been delivered. Perfect for demos and evaluating the pipeline.

## Going live with Twilio

Set three environment variables and real delivery switches on — no code changes:

\`\`\`
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
\`\`\``,
      related: ["escalation-policies", "notifications-feed"],
    },
    {
      id: "notifications-feed",
      title: "The Notifications feed",
      category: "oncall",
      tags: ["notifications", "audit", "simulation"],
      body: `The **Notifications** page is the delivery log: every SMS, voice call, email, and push the system sent (or simulated), with recipient, channel, and the triggering incident.

Use it to:

- Verify a page actually went out during an incident review
- Demo the paging pipeline without spending a cent (simulation mode)
- Debug "I never got paged" — the feed shows what was attempted, where, and when`,
      related: ["notification-channels"],
    },

    // ---------- Alerts & ingestion ----------
    {
      id: "alert-ingestion",
      title: "Ingesting alerts from your monitoring tools",
      category: "alerts",
      featured: true,
      tags: ["webhook", "grafana", "datadog", "cloudwatch", "ingest"],
      body: `Anything that can send JSON can feed Incidently — Grafana, Datadog, CloudWatch, cron jobs, you name it.

## The webhook

\`\`\`
POST /api/ingest
Authorization: Bearer <ingest token>
\`\`\`

\`\`\`json
{
  "title": "High p99 latency on payments-api",
  "severity": "critical",
  "service": "payments-api",
  "dedup_key": "payments-p99",
  "status": "firing"
}
\`\`\`

Tokens are created under **Settings → API keys**.

## Dedup

Repeat alerts with the same \`dedup_key\` bump a counter on the existing alert instead of flooding the feed. When the source sends \`"status": "resolved"\`, the alert auto-closes.

Try it with a **one-click test alert** from the Alerts page.`,
      related: ["promotion-rules", "alerts-feed", "api-keys"],
    },
    {
      id: "promotion-rules",
      title: "Promotion rules: alerts that declare themselves",
      category: "alerts",
      tags: ["promotion", "auto-declare", "tiers"],
      body: `Some alerts shouldn't wait for a human. Promotion rules turn qualifying alerts straight into incidents:

- **Critical alert on a tier-1 service** → SEV1 incident auto-declared, on-call paged — no human in the loop
- **Critical alert on a tier-2/3 service** → SEV2 incident auto-declared
- **Service already has an open incident** → the alert attaches to it instead of declaring a duplicate

Everything else lands in the Alerts feed for a human to triage. Service tiers are set in the **Services** catalog — tier your services deliberately, they decide what can wake people at 3am on its own.`,
      related: ["alert-ingestion", "alerts-feed", "services-catalog"],
    },
    {
      id: "alerts-feed",
      title: "Triaging the Alerts feed",
      category: "alerts",
      tags: ["triage", "ack", "promote"],
      body: `The **Alerts** page is the queue of everything ingested that didn't auto-promote.

For each alert you can:

- **Ack** — "seen it, I own it"
- **Resolve** — noise or already fixed
- **Promote** — turn it into a real incident, carrying its context along

Firing counts show how many times a deduped alert re-fired — a 47× counter is telling you something a single ping wouldn't.`,
      related: ["alert-ingestion", "promotion-rules", "declare-incident"],
    },

    // ---------- Postmortems & remediations ----------
    {
      id: "postmortem-basics",
      title: "Writing a blameless postmortem",
      category: "learning",
      featured: true,
      tags: ["postmortem", "blameless", "root-cause"],
      body: `SEV0–SEV2 incidents get a postmortem automatically on resolve; the incident timeline is embedded so nobody reconstructs history from memory.

## The guided template

- **Summary** and **customer impact**
- **Root cause** — the conditions, not the culprit
- **What went well / what went poorly** — about systems and process
- **Where we got lucky** — the near-misses that will not save you twice

## Blameless means blameless

Name systems, gaps, and decisions-with-context — never fault. *"The deploy pipeline allowed an untested config change"*, not *"Alex pushed a bad config."* People who fear postmortems stop declaring incidents, and then you fly blind.

## Review workflow

**Draft → In Review → Published.** Published postmortems are the team's institutional memory.`,
      related: ["resolving-incidents", "remediations-board"],
    },
    {
      id: "remediations-board",
      title: "Tracking remediations to done",
      category: "learning",
      tags: ["action-items", "kanban", "follow-up", "overdue"],
      body: `Action items captured during incidents and postmortems all land on the **Remediations** board — a kanban across every incident.

Each item carries an **owner**, a **priority**, and a **due date**. Overdue items are flagged so the fixes you promised in the postmortem don't quietly evaporate.

The board answers the question every incident review should end with: *did we actually do the things we said we'd do last time?*

Push any item to Jira with one click — see *Pushing action items to Jira* in the related articles.`,
      related: ["jira-integration", "postmortem-basics"],
    },
    {
      id: "jira-integration",
      title: "Pushing action items to Jira",
      category: "learning",
      tags: ["jira", "integration", "issues"],
      body: `Teams that live in Jira can push any action item there with one click — the created issue stays linked to the action item.

## Setup (Settings → Jira)

- **Site URL** — \`https://yourteam.atlassian.net\`
- **Email + API token** — from your Atlassian account
- **Project key** — where issues land

Use **Test connection** to verify before saving.

## Mock mode

No Jira site handy? Enable mock mode to get realistic issue keys without a real site — the full flow works for demos and trials.`,
      related: ["remediations-board"],
    },

    // ---------- Services, runbooks & status ----------
    {
      id: "services-catalog",
      title: "The service catalog and tiers",
      category: "platform",
      tags: ["services", "tiers", "catalog", "slo"],
      body: `**Services** is the catalog of everything you operate. Each service carries:

- A **tier** (1 = most critical) — drives promotion rules and paging aggressiveness
- An **escalation policy** — who gets paged when it breaks
- **Runbooks** — surfaced automatically in incident rooms
- **SLO tracking** — availability against target at a glance

Keep the catalog honest: a mis-tiered service either wakes people needlessly or lets a real outage idle in a queue.`,
      related: ["promotion-rules", "runbooks-guide", "maintenance-windows"],
    },
    {
      id: "runbooks-guide",
      title: "Writing runbooks that help at 3am",
      category: "platform",
      featured: true,
      tags: ["runbooks", "markdown", "procedures"],
      body: `Runbooks are markdown procedures attached to services, written with a live preview editor. When an incident is declared, runbooks for the affected service appear **in the incident room** — the 3am answer to "now what?".

## What makes a runbook good

- **Commands ready to paste**, with placeholders clearly marked
- **Decision points, not essays** — "if X, do Y; otherwise Z"
- **Verification steps** — how do you know the fix worked?
- **Escalation guidance** — when to stop and page a specialist

\`\`\`markdown
## Elevated error rates
1. Check the deploy log: \`deployctl history payments-api\`
2. Last deploy < 1h ago? → roll back: \`deployctl rollback payments-api\`
3. Errors persist after rollback → page the DB on-call (Escalate button)
\`\`\`

Stale runbooks are worse than none — after every incident where one fell short, fixing it is a remediation.`,
      related: ["incident-room", "services-catalog", "remediations-board"],
    },
    {
      id: "maintenance-windows",
      title: "Maintenance windows",
      category: "platform",
      tags: ["maintenance", "planned", "downtime"],
      body: `Planned work shouldn't page anyone or scare customers. Schedule a maintenance window on a service (from the **Services** page) and during it:

- The status page shows **planned maintenance** instead of an outage
- Expected blips don't trigger the full incident machinery

Schedule windows ahead of time so stakeholders see them coming, and keep the scope tight — a window is not a license to ignore real alerts on other services.`,
      related: ["services-catalog", "status-page"],
    },
    {
      id: "status-page",
      title: "The public status page",
      category: "platform",
      tags: ["status", "public", "customers"],
      body: `The **Status Page** is the customer-facing view: current state per service, active incidents with published updates, and planned maintenance.

It shows only what you publish — internal notes and the incident room stay private; status updates marked public appear here.

During an incident, the status page is your deflector shield: one good published update prevents a hundred support tickets.`,
      related: ["status-updates", "maintenance-windows"],
    },
    {
      id: "analytics-guide",
      title: "Analytics: MTTA, MTTR, and trends",
      category: "platform",
      tags: ["analytics", "mtta", "mttr", "metrics"],
      body: `Analytics turns the timestamps every incident records (declared / acknowledged / mitigated / resolved) into the numbers reviews ask for:

- **MTTA** — mean time to acknowledge: how fast a human owns the page
- **MTTR** — mean time to resolve: how fast service is restored
- Incident **volume and severity mix** over time, per service

Watch trends, not single points — one gnarly SEV1 skews a month. A climbing MTTA is an on-call health problem; a climbing MTTR is usually a runbook and tooling problem.`,
      related: ["resolving-incidents", "runbooks-guide"],
    },

    // ---------- Settings & integrations ----------
    {
      id: "api-keys",
      title: "API keys for alert ingestion",
      category: "admin",
      tags: ["api-keys", "tokens", "security"],
      body: `The ingest webhook is token-secured. Manage tokens under **Settings → API keys**:

- Create a **separate key per source** (Grafana, Datadog, cron) so you can revoke one without breaking the rest
- Revoke immediately if a key leaks — creation and revocation take effect instantly

Send the key as a bearer token:

\`\`\`
Authorization: Bearer <your key>
\`\`\``,
      related: ["alert-ingestion"],
    },
    {
      id: "outbound-webhooks",
      title: "Outbound webhooks",
      category: "admin",
      tags: ["webhooks", "integrations", "events"],
      body: `Push Incidently events to other systems — chat bots, dashboards, data warehouses. Configure destinations under **Settings → Webhooks**: each receives a JSON POST when subscribed events fire (incident declared, status changed, resolved, and more).

Point one at a request bin first to see the exact payload shapes before wiring up a consumer.`,
      related: ["api-keys", "jira-integration"],
    },
  ],
};
