# Incidently ⚡

**Declare, respond, learn.** A full-featured incident management platform in the spirit of incident.io and PagerDuty — declare incidents, page on-call responders, publish status updates, run blameless postmortems, and track remediations to done, with Jira integration built in.

## Quick start

```bash
npm install
npx prisma db push          # create SQLite database
npx tsx prisma/seed.ts      # load demo data (6 users, 6 services, incidents + postmortems)
npm run dev                 # → http://localhost:3000
```

## Features

### 🚨 Incident lifecycle
- **Declare** with severity (SEV1–SEV4), affected service, and summary — level 1 of the service's escalation policy is paged instantly and a dedicated channel is opened
- **Status workflow**: Triage → Investigating → Identified → Monitoring → Resolved, with a one-click stepper
- **Response roles**: Incident Commander, Comms Lead, Ops Lead, Scribe
- **Live timeline** capturing every event automatically — declarations, pages, acks, status changes, notes, escalations
- **Status updates** published to stakeholders and the public status page
- Key timestamps (declared / acknowledged / mitigated / resolved) tracked for analytics

### 📟 On-call & escalation
- Rotation schedules with visual shift timelines and "on call now" indicators
- Multi-level escalation policies (schedule- or user-targeted) with per-level ack timeouts
- Unacknowledged pages auto-escalate to the next level; manual **Escalate** button for when you need more hands

### 📱 Notifications (SMS · Voice · Email · Push)
- Every page fans out across channels; SEV1/SEV2 get SMS **and** a voice call
- **Zero-cost simulation mode by default**: every message is recorded to the Notifications feed exactly as it would be delivered
- **Twilio-ready**: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in `.env` and real SMS/voice delivery switches on — no code changes

### 📖 Postmortems
- Auto-created for SEV1/SEV2 incidents on resolve
- Guided blameless template: summary, impact, root cause, what went well / poorly, where we got lucky
- Auto-captured incident timeline embedded; review workflow (Draft → In Review → Published)

### ✅ Remediations
- Action items with owners, priorities, and due dates; kanban board across all incidents
- Overdue tracking so nothing falls through the cracks

### 🔷 Jira integration
- Push any action item to Jira Cloud (REST v3) with one click; issues stay linked
- **Mock mode** for demos — realistic issue keys without a real Jira site
- Configure site URL / email / API token / project key in Settings, with connection test

### 📡 Alert ingestion
- Token-secured webhook (`POST /api/ingest`) for Grafana / Datadog / CloudWatch / anything that can send JSON
- Dedup by `dedup_key` — repeat alerts bump a counter instead of flooding the feed; `status: "resolved"` from the source auto-closes them
- **Promotion rules**: critical + tier-1 service → SEV1 incident auto-declared (pages on-call, no human in the loop) · critical + tier-2/3 → SEV2 · service already has an open incident → alert attaches to it
- Alerts feed with ack/resolve/promote and one-click test alerts to demo the whole pipeline

### 📘 Runbooks
- Markdown runbooks attached to services, with live preview editing
- Automatically surfaced in the incident room for the affected service — the 3am answer to "now what?"

### ⏱️ Real auto-escalation & overrides
- A background ticker (Next.js instrumentation) sweeps every 60s: unacknowledged pages past their level's delay fire the next escalation level automatically
- One-click on-call overrides — "I've got it tonight" without editing the rotation

### ⌨️ Command palette
- `Ctrl+K` anywhere: search incidents (by number too — "1007"), services, runbooks, postmortems, plus quick actions

### 🎯 SLOs & error budgets
- One availability SLO per service (configurable target, 30-day window) with a live error-budget bar
- Burn math: SEV1 minutes count in full, SEV2 at half; open incidents burn to now; window-straddling incidents are clipped
- Exposed in the UI, the public API, and turning red before your customers notice

### 🔑 Public REST API (v1)
- `GET/POST /api/v1/incidents`, `GET /api/v1/incidents/:number` (full timeline), `GET /api/v1/services` (effective status + SLO burn), `GET /api/v1/oncall`
- API keys with SHA-256 storage — token shown exactly once, revoke instantly, last-used tracking
- Declaring through the API pages on-call exactly like the UI

### 📤 CSV export
- One-click export of the full incident history with lifecycle timestamps, MTTA/MTTR per incident, and postmortem status — audit and compliance ready

### 🌐 Status page
- Public-facing status page with component health, active incident updates, and 14-day history
- Service status auto-degrades on SEV1/SEV2 declaration and auto-restores on resolve

### 📊 Analytics
- MTTA / MTTR, weekly incident volume, MTTR trend, breakdowns by severity and service

## Testing

Three layers, 120 checks total:

```bash
npm run test:unit          # 49 unit tests — engines against an isolated SQLite db
npm run test:integration   # 34 API tests — every route over real HTTP (needs `npm run dev` running)
npm run test:e2e           # 37 Playwright tests — every user journey in a real browser
npm run test:all           # the whole pyramid
```

CI (GitHub Actions) runs lint → typecheck → unit → build → integration → E2E on every push.

- **Unit** (`tests/unit/`): alert dedup/promotion rules, escalation sweep + on-call resolution, incident lifecycle side effects, notification fan-out per severity, the Twilio adapter (fetch mocked), and the Jira client in both mock and real mode. Each suite clones the schema into its own throwaway db.
- **Integration** (`tests/integration/`): all 18 API routes — validation, auth (ingest token), side effects verified in the db, error paths. Reseeds before and after, leaving the app in demo state.
- **E2E** (`e2e/`): declare→page→ack→update→Jira→resolve→postmortem as a serial journey, plus alerts pipeline (real webhook + browser), on-call override, runbook creation + incident surfacing, Ctrl+K palette, status page, notifications, analytics, settings. Auto-reseeds via global setup; reuses your running dev server or starts one.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma + SQLite · zero runtime dependencies beyond that

## Architecture notes

- `lib/notify.ts` — provider-abstracted notification engine (simulator ⇄ Twilio)
- `lib/escalation.ts` — on-call resolution + escalation sweep (fires opportunistically; no cron needed for the demo)
- `lib/jira.ts` — Jira Cloud client with mock backend behind the same interface
- `lib/actions.ts` — domain operations (declare, status transitions, ack) shared by API routes
- `prisma/schema.prisma` — the full domain model: incidents, roles, events, schedules, policies, pages, notifications, postmortems, action items, Jira links
