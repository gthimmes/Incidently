import { prisma } from "@/lib/db";
import { whoIsOnCall } from "@/lib/escalation";
import { Avatar } from "@/components/ui";
import OverrideButton from "./OverrideButton";

export const dynamic = "force-dynamic";

const DAY = 24 * 3600_000;

export default async function OnCallPage() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const [schedules, policies] = await Promise.all([
    prisma.schedule.findMany({
      include: {
        shifts: {
          where: { endsAt: { gte: new Date(Date.now() - 7 * DAY) } },
          include: { user: true },
          orderBy: { startsAt: "asc" },
          take: 8,
        },
      },
    }),
    prisma.escalationPolicy.findMany({
      include: {
        levels: {
          orderBy: { levelNumber: "asc" },
          include: { targets: { include: { user: true, schedule: true } } },
        },
        services: true,
      },
    }),
  ]);

  const onCall = await Promise.all(
    schedules.map(async (s) => ({ id: s.id, user: await whoIsOnCall(s.id) }))
  );
  const onCallMap = new Map(onCall.map((o) => [o.id, o.user]));

  return (
    <div className="space-y-8 animate-in">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">On-Call</h1>
        <p className="text-dim text-sm mt-0.5">Rotations, coverage, and escalation paths.</p>
      </header>

      {/* schedules */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wide">Schedules</h2>
        <div className="grid grid-cols-2 gap-5">
          {schedules.map((schedule) => {
            const current = onCallMap.get(schedule.id);
            const now = Date.now();
            return (
              <div key={schedule.id} className="card p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">{schedule.name}</h3>
                  <span className="text-xs text-dim">{schedule.rotationDays}-day rotation</span>
                </div>
                <p className="text-dim text-sm mb-4">{schedule.description}</p>

                {current && (
                  <div className="flex items-center gap-3 rounded-lg bg-elevated border border-line p-3 mb-4">
                    <div className="relative">
                      <Avatar name={current.name} color={current.avatarColor} size={36} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-panel" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{current.name}</p>
                      <p className="text-xs text-green-400">On call now</p>
                    </div>
                    <OverrideButton scheduleId={schedule.id} users={users} />
                  </div>
                )}

                {/* upcoming shifts timeline */}
                <div className="space-y-1.5">
                  {schedule.shifts.map((shift) => {
                    const active = shift.startsAt.getTime() <= now && shift.endsAt.getTime() > now;
                    const past = shift.endsAt.getTime() <= now;
                    return (
                      <div
                        key={shift.id}
                        className={`flex items-center gap-2.5 text-sm rounded-md px-2.5 py-1.5 ${
                          active ? "bg-accent/10 border border-accent/40" : past ? "opacity-40" : ""
                        }`}
                      >
                        <Avatar name={shift.user.name} color={shift.user.avatarColor} size={20} />
                        <span className={active ? "font-medium" : ""}>{shift.user.name}</span>
                        <span className="text-xs text-dim ml-auto font-mono" suppressHydrationWarning>
                          {shift.startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          {" – "}
                          {shift.endsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* escalation policies */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wide">Escalation policies</h2>
        {policies.map((policy) => (
          <div key={policy.id} className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{policy.name}</h3>
              <span className="text-xs text-dim">
                Covers: {policy.services.map((s) => s.name).join(", ") || "no services"}
              </span>
            </div>
            <p className="text-dim text-sm mb-5">{policy.description}</p>

            <div className="flex items-stretch gap-0">
              {policy.levels.map((level, i) => (
                <div key={level.id} className="flex items-center">
                  {i > 0 && (
                    <div className="flex flex-col items-center px-3">
                      <span className="text-[10px] text-dim whitespace-nowrap mb-1">
                        after {policy.levels[i - 1].delayMinutes}m unacked
                      </span>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-dim" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14m-6-6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <div className="rounded-lg border border-line bg-elevated p-3.5 min-w-44">
                    <p className="text-xs font-bold text-accent mb-2">LEVEL {level.levelNumber}</p>
                    {level.targets.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm py-0.5">
                        {t.user ? (
                          <>
                            <Avatar name={t.user.name} color={t.user.avatarColor} size={20} />
                            <span>{t.user.name}</span>
                          </>
                        ) : t.schedule ? (
                          <>
                            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px]">⟳</span>
                            <span>{t.schedule.name}</span>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
