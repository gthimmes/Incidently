import Link from "next/link";
import { prisma } from "@/lib/db";
import { Avatar, TimeAgo } from "@/components/ui";

export const dynamic = "force-dynamic";

const CHANNEL_META: Record<string, { icon: string; label: string; color: string }> = {
  sms: { icon: "💬", label: "SMS", color: "#22c55e" },
  voice: { icon: "📞", label: "Voice call", color: "#f97316" },
  email: { icon: "✉️", label: "Email", color: "#3b82f6" },
  push: { icon: "📱", label: "Push", color: "#8b5cf6" },
  slack: { icon: "💼", label: "Slack", color: "#06b6d4" },
};

export default async function NotificationsPage() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, incident: true },
  });

  const twilioLive = Boolean(process.env.TWILIO_ACCOUNT_SID);

  return (
    <div className="space-y-5 animate-in max-w-4xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-dim text-sm mt-0.5">
          Every page and alert delivered by the platform, across every channel.
        </p>
      </header>

      <div
        className={`rounded-lg border p-3.5 text-sm flex items-center gap-3 ${
          twilioLive ? "border-green-500/40 bg-green-500/5" : "border-yellow-500/40 bg-yellow-500/5"
        }`}
      >
        <span className="text-lg">{twilioLive ? "🟢" : "🟡"}</span>
        <div>
          {twilioLive ? (
            <p><span className="font-semibold text-green-400">Live mode.</span> SMS and voice are delivered via Twilio.</p>
          ) : (
            <>
              <p className="font-semibold text-yellow-400">Simulation mode — zero cost.</p>
              <p className="text-dim text-xs mt-0.5">
                Every message below shows exactly what would be sent. Set{" "}
                <code className="font-mono bg-elevated px-1 rounded">TWILIO_ACCOUNT_SID</code>,{" "}
                <code className="font-mono bg-elevated px-1 rounded">TWILIO_AUTH_TOKEN</code> and{" "}
                <code className="font-mono bg-elevated px-1 rounded">TWILIO_FROM_NUMBER</code> to go live —
                no code changes needed.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {notifications.map((n) => {
          const meta = CHANNEL_META[n.channel] ?? CHANNEL_META.email;
          return (
            <div key={n.id} className="card px-4 py-3 flex items-start gap-3">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}40` }}
              >
                {meta.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-dim mb-1">
                  <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  <span>→</span>
                  <span className="font-mono">{n.recipient}</span>
                  {n.user && (
                    <span className="flex items-center gap-1">
                      (<Avatar name={n.user.name} color={n.user.avatarColor} size={14} /> {n.user.name})
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium ${
                        n.status === "failed"
                          ? "bg-red-500/15 text-red-400"
                          : n.status === "simulated"
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-green-500/15 text-green-400"
                      }`}
                    >
                      {n.status}
                    </span>
                    <TimeAgo date={n.createdAt} />
                  </span>
                </div>
                <p className="text-sm text-ink/85 leading-snug">{n.body}</p>
                {n.incident && (
                  <Link href={`/incidents/${n.incidentId}`} className="text-xs text-accent hover:underline font-mono">
                    INC-{n.incident.number}
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
