# Demo recordings

## `incidently-demo.mp4` — full product walkthrough (2m 45s)

Automated Playwright recording (ui-demo-recording harness): eased cursor motion,
frame-honest captions, one continuous take against a freshly seeded local app.

**What it shows, in order:**
1. Operations dashboard — open incidents, MTTA/MTTR, on-call now, service health
2. Declaring a SEV1 against Public API (title, summary, severity, service)
3. The incident room — automatic level-1 page (SMS · voice · email · push), ack,
   status stepper to Investigating, timeline note
4. Publishing a stakeholder status update
5. Creating a remediation action item and pushing it to Jira (mock mode → `OPS-…` key)
6. Notifications feed — every simulated delivery on the record, Twilio env vars flip it live
7. Public status page — auto-degraded to Major Outage, published update visible
8. Resolve → postmortem draft auto-created → guided blameless template
9. Remediations board and analytics

**What is real vs. simulated:** every click drives the real app and database.
SMS/voice/email/push deliveries are recorded by the simulator provider (zero
cost); Jira issues are created by the built-in mock backend. Both switch to live
services via configuration only (Twilio env vars / Jira credentials in Settings).

**Provenance:** recorded 2026-08-06 against `main`, seeded via `prisma/seed.ts`,
1280×720@2x H.264 yuv420p faststart, 25fps, 164.8s, ~11.6 MB. Verified by
frame review at 8 anchors per the recording runbook.

## `incidently_full_demo.gif`

Earlier quick capture of a live interactive session (browser-extension
recording). Superseded by the MP4 above for sharing.

## `incidently-sprint2.mp4` — alerts pipeline walkthrough (79s)

Critical monitoring alert → auto-declared SEV1 → on-call paged, plus runbooks,
Ctrl+K palette, and on-call overrides. Recorded 2026-08-06.

## `incidently-sprint3.mp4` — maintenance & insights walkthrough (71s)

Maintenance windows (schedule → status page → effective Maintenance status),
Slack #incidents broadcasts in the notifications feed, and the on-call load
"burnout radar" in analytics. Recorded 2026-08-08, frame-verified.
