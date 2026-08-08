/**
 * Maintenance windows + Slack broadcasting unit tests.
 */
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { initTestDb, cleanupTestDb, wipeAll } from "./test-db";

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let effectiveServiceStatuses: any, upcomingWindows: any;
let broadcastToSlack: any;
let dbFile: string;

const HOUR = 3600_000;

beforeAll(async () => {
  dbFile = initTestDb("maintenance");
  ({ prisma } = await import("@/lib/db"));
  ({ effectiveServiceStatuses, upcomingWindows } = await import("@/lib/maintenance"));
  ({ broadcastToSlack } = await import("@/lib/slack"));
});

afterAll(async () => {
  await prisma.$disconnect();
  cleanupTestDb(dbFile);
});

beforeEach(async () => {
  delete process.env.SLACK_WEBHOOK_URL;
  await wipeAll(prisma);
  await prisma.maintenanceWindow.deleteMany();
});

afterEach(() => {
  delete process.env.SLACK_WEBHOOK_URL;
  vi.unstubAllGlobals();
});

async function makeService(status = "operational") {
  return prisma.service.create({
    data: { name: `Svc ${Math.random().toString(36).slice(2, 8)}`, slug: `svc-${Math.random().toString(36).slice(2, 8)}`, status },
  });
}

function window(serviceId: string, startOffsetH: number, endOffsetH: number, cancelled = false) {
  return prisma.maintenanceWindow.create({
    data: {
      title: "Planned work",
      serviceId,
      startsAt: new Date(Date.now() + startOffsetH * HOUR),
      endsAt: new Date(Date.now() + endOffsetH * HOUR),
      cancelled,
    },
  });
}

describe("effectiveServiceStatuses", () => {
  it("reports maintenance while a window is active on a healthy service", async () => {
    const svc = await makeService();
    await window(svc.id, -1, 1);
    const map = await effectiveServiceStatuses([svc.id]);
    expect(map.get(svc.id)?.effectiveStatus).toBe("maintenance");
    expect(map.get(svc.id)?.activeWindow?.title).toBe("Planned work");
  });

  it("an incident-driven state outranks planned maintenance", async () => {
    const svc = await makeService("major_outage");
    await window(svc.id, -1, 1);
    const map = await effectiveServiceStatuses([svc.id]);
    expect(map.get(svc.id)?.effectiveStatus).toBe("major_outage");
  });

  it("future and cancelled windows do not change the status", async () => {
    const svc = await makeService();
    await window(svc.id, 2, 4); // future
    await window(svc.id, -1, 1, true); // cancelled
    const map = await effectiveServiceStatuses([svc.id]);
    expect(map.get(svc.id)?.effectiveStatus).toBe("operational");
    expect(map.get(svc.id)?.activeWindow).toBeNull();
  });

  it("expired windows do not change the status", async () => {
    const svc = await makeService();
    await window(svc.id, -4, -2);
    const map = await effectiveServiceStatuses([svc.id]);
    expect(map.get(svc.id)?.effectiveStatus).toBe("operational");
  });
});

describe("upcomingWindows", () => {
  it("returns active and future windows, skipping cancelled and past ones", async () => {
    const svc = await makeService();
    await window(svc.id, -1, 1); // active
    await window(svc.id, 24, 26); // future
    await window(svc.id, -5, -3); // past
    await window(svc.id, 2, 3, true); // cancelled

    const windows = await upcomingWindows();
    expect(windows).toHaveLength(2);
  });

  it("ignores windows starting beyond the horizon", async () => {
    const svc = await makeService();
    await window(svc.id, 20 * 24, 20 * 24 + 2); // 20 days out, default horizon 14
    expect(await upcomingWindows()).toHaveLength(0);
    expect(await upcomingWindows(30)).toHaveLength(1);
  });
});

describe("broadcastToSlack", () => {
  it("records a simulated notification when no webhook is configured", async () => {
    await broadcastToSlack({ text: "hello channel" });
    const n = await prisma.notification.findFirst();
    expect(n.channel).toBe("slack");
    expect(n.provider).toBe("simulator");
    expect(n.status).toBe("simulated");
    expect(n.recipient).toBe("#incidents");
  });

  it("posts to the webhook and records sent when configured", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T/B/x";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await broadcastToSlack({ text: ":rotating_light: test" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T/B/x",
      expect.objectContaining({ method: "POST" }),
    );
    const n = await prisma.notification.findFirst();
    expect(n.provider).toBe("slack-webhook");
    expect(n.status).toBe("sent");
  });

  it("records failed when the webhook errors, without throwing", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T/B/x";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    await expect(broadcastToSlack({ text: "x" })).resolves.toBeUndefined();
    const n = await prisma.notification.findFirst();
    expect(n.status).toBe("failed");
  });
});
