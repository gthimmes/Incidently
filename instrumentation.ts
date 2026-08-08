// Server-side background ticker.
//
// Every 60s: sweep escalations (unacked pages past their level's delay fire
// the next level of the policy — SMS/voice/email/push go out with no human
// in the loop). Runs inside the Next.js server process, so `npm run dev` /
// `npm start` is all you need — no external cron.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __incidently_ticker?: boolean };
  if (g.__incidently_ticker) return; // dev hot-reload guard
  g.__incidently_ticker = true;

  const { sweepEscalations } = await import("./lib/escalation");

  setInterval(async () => {
    try {
      const result = await sweepEscalations();
      if (result.escalated > 0) {
        console.log(`[incidently] escalation sweep: ${result.escalated} incident(s) escalated`);
      }
    } catch (err) {
      console.error("[incidently] escalation sweep failed:", err);
    }
  }, 60_000);

  console.log("[incidently] escalation ticker started (60s interval)");
}
