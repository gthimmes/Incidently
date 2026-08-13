import { getJiraConfig } from "@/lib/jira";
import { prisma } from "@/lib/db";
import JiraSettings from "./JiraSettings";
import ApiKeysPanel from "./ApiKeysPanel";
import WebhooksPanel from "./WebhooksPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const cfg = await getJiraConfig();
  const apiKeys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  const hooks = await prisma.webhookSubscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      deliveries: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { deliveries: true } },
    },
  });
  const twilioLive = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
  );

  return (
    <div className="space-y-8 animate-in max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-dim text-sm mt-0.5">Integrations and delivery providers.</p>
      </header>

      <JiraSettings
        initial={{
          baseUrl: cfg.baseUrl,
          email: cfg.email,
          apiToken: cfg.apiToken ? "•••" : "",
          projectKey: cfg.projectKey,
          mockMode: cfg.mockMode,
        }}
      />

      <WebhooksPanel
        hooks={hooks.map((h) => ({
          id: h.id,
          name: h.name,
          url: h.url,
          events: h.events,
          active: h.active,
          createdAt: h.createdAt.toISOString(),
          deliveryCount: h._count.deliveries,
          deliveries: h.deliveries.map((d) => ({
            id: d.id,
            event: d.event,
            status: d.status,
            statusCode: d.statusCode,
            durationMs: d.durationMs,
            createdAt: d.createdAt.toISOString(),
          })),
        }))}
      />

      <ApiKeysPanel
        keys={apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          revoked: k.revoked,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />

      <section className="card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📞</span>
          <div>
            <h2 className="font-semibold">SMS & Voice — Twilio</h2>
            <p className="text-dim text-sm">Phone paging for on-call responders.</p>
          </div>
          <span
            className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
              twilioLive ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
            }`}
          >
            {twilioLive ? "Live" : "Simulation mode"}
          </span>
        </div>
        <div className="rounded-lg bg-elevated border border-line p-4 text-sm text-dim leading-relaxed space-y-2">
          <p>
            Incidently is running in <span className="text-yellow-400 font-medium">zero-cost simulation mode</span>:
            every SMS, voice call, email and push notification is recorded to the{" "}
            <a href="/notifications" className="text-accent hover:underline">Notifications feed</a> exactly as it
            would be delivered.
          </p>
          <p>To flip to live delivery, add these to <code className="font-mono bg-panel px-1 rounded">.env</code> and restart — the Twilio adapter takes over automatically:</p>
          <pre className="font-mono text-xs bg-panel rounded-lg p-3 text-ink/80">{`TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+15551234567`}</pre>
          <p className="text-xs">
            Voice calls use Twilio TTS with an &quot;acknowledge&quot; prompt. SEV1/SEV2 pages get SMS + voice;
            lower severities get SMS only.
          </p>
        </div>
      </section>
    </div>
  );
}
