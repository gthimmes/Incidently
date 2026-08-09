/**
 * SLO math + API key unit tests.
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { initTestDb, cleanupTestDb, wipeAll } from "./test-db";

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let computeBurnedMinutes: any, sloStatusForServices: any;
let createApiKey: any, verifyApiKey: any, requireApiKey: any;
let dbFile: string;

const MIN = 60_000;
const HOUR = 60 * MIN;

beforeAll(async () => {
  dbFile = initTestDb("slo");
  ({ prisma } = await import("@/lib/db"));
  ({ computeBurnedMinutes, sloStatusForServices } = await import("@/lib/slo"));
  ({ createApiKey, verifyApiKey, requireApiKey } = await import("@/lib/apikeys"));
});

afterAll(async () => {
  await prisma.$disconnect();
  cleanupTestDb(dbFile);
});

beforeEach(async () => {
  await wipeAll(prisma);
  await prisma.slo.deleteMany();
  await prisma.apiKey.deleteMany();
});

describe("computeBurnedMinutes", () => {
  const now = new Date("2026-08-08T12:00:00Z");
  const windowStart = new Date(now.getTime() - 30 * 24 * HOUR);

  function inc(severity: string, startMinAgo: number, durationMin: number | null) {
    return {
      severity,
      declaredAt: new Date(now.getTime() - startMinAgo * MIN),
      resolvedAt: durationMin == null ? null : new Date(now.getTime() - (startMinAgo - durationMin) * MIN),
    };
  }

  it("weights sev1 fully and sev2 at half; sev3/4 burn nothing", async () => {
    const burned = computeBurnedMinutes(
      [inc("sev1", 500, 60), inc("sev2", 400, 60), inc("sev3", 300, 60), inc("sev4", 200, 60)],
      windowStart,
      now,
    );
    expect(burned).toBeCloseTo(60 + 30, 5);
  });

  it("open incidents burn up to now", () => {
    const burned = computeBurnedMinutes([inc("sev1", 90, null)], windowStart, now);
    expect(burned).toBeCloseTo(90, 5);
  });

  it("clips incidents straddling the window start", () => {
    // declared 10 minutes before the window opened, resolved 50 min after
    const straddler = {
      severity: "sev1",
      declaredAt: new Date(windowStart.getTime() - 10 * MIN),
      resolvedAt: new Date(windowStart.getTime() + 50 * MIN),
    };
    expect(computeBurnedMinutes([straddler], windowStart, now)).toBeCloseTo(50, 5);
  });

  it("ignores incidents fully outside the window", () => {
    const ancient = {
      severity: "sev1",
      declaredAt: new Date(windowStart.getTime() - 10 * HOUR),
      resolvedAt: new Date(windowStart.getTime() - 9 * HOUR),
    };
    expect(computeBurnedMinutes([ancient], windowStart, now)).toBe(0);
  });
});

describe("sloStatusForServices", () => {
  it("computes budget from target and window, flags blown budgets", async () => {
    const svc = await prisma.service.create({
      data: { name: "SLO Svc", slug: "slo-svc", tier: 1 },
    });
    await prisma.slo.create({ data: { serviceId: svc.id, targetPct: 99.9, windowDays: 30 } });
    // one resolved sev1 lasting 60m inside the window → budget 43.2m → blown
    await prisma.incident.create({
      data: {
        number: 8801, title: "Burn", severity: "sev1", status: "resolved",
        serviceId: svc.id,
        declaredAt: new Date(Date.now() - 5 * 24 * HOUR),
        resolvedAt: new Date(Date.now() - 5 * 24 * HOUR + 60 * MIN),
      },
    });

    const map = await sloStatusForServices([svc.id]);
    const slo = map.get(svc.id)!;
    expect(slo.budgetMinutes).toBeCloseTo(43.2, 1);
    expect(slo.burnedMinutes).toBeCloseTo(60, 1);
    expect(slo.burnPct).toBeGreaterThan(100);
    expect(slo.healthy).toBe(false);
    expect(slo.remainingMinutes).toBe(0);
  });

  it("services without an SLO are absent from the map", async () => {
    const svc = await prisma.service.create({ data: { name: "NoSlo", slug: "no-slo", tier: 3 } });
    const map = await sloStatusForServices([svc.id]);
    expect(map.has(svc.id)).toBe(false);
  });
});

describe("API keys", () => {
  it("creates keys with the expected shape and verifies them", async () => {
    const { token, prefix } = await createApiKey("test key");
    expect(token).toMatch(/^ink_live_[0-9a-f]{40}$/);
    expect(prefix).toBe(token.slice(0, 12));

    const key = await verifyApiKey(token);
    expect(key).not.toBeNull();
    expect(key.name).toBe("test key");
    expect(key.lastUsedAt).not.toBeNull();

    // token is not stored in the clear
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } });
    expect(row.keyHash).not.toContain(token.slice(12));
  });

  it("rejects garbage, wrong, and revoked tokens", async () => {
    const { token, id } = await createApiKey("revoke me");
    expect(await verifyApiKey(null)).toBeNull();
    expect(await verifyApiKey("not-a-key")).toBeNull();
    expect(await verifyApiKey("ink_live_" + "0".repeat(40))).toBeNull();

    await prisma.apiKey.update({ where: { id }, data: { revoked: true } });
    expect(await verifyApiKey(token)).toBeNull();
  });

  it("requireApiKey guards a Request via the Authorization header", async () => {
    const { token } = await createApiKey("guard");
    const good = await requireApiKey(
      new Request("http://x/api/v1/incidents", { headers: { Authorization: `Bearer ${token}` } }),
    );
    expect(good.ok).toBe(true);

    const bad = await requireApiKey(new Request("http://x/api/v1/incidents"));
    expect(bad.ok).toBe(false);
    expect((bad as { status: number }).status).toBe(401);
  });
});
