/**
 * Outbound webhook unit tests: signing, event filtering, delivery
 * logging (fetch stubbed), test pings, and redelivery.
 */
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import { initTestDb, cleanupTestDb, wipeAll } from "./test-db";

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let signPayload: any, subscriptionMatches: any, emitWebhookEvent: any;
let sendTestDelivery: any, redeliver: any, newWebhookSecret: any, incidentSnapshot: any;
let dbFile: string;

beforeAll(async () => {
  dbFile = initTestDb("webhooks");
  ({ prisma } = await import("@/lib/db"));
  ({
    signPayload,
    subscriptionMatches,
    emitWebhookEvent,
    sendTestDelivery,
    redeliver,
    newWebhookSecret,
    incidentSnapshot,
  } = await import("@/lib/webhooks"));
});

afterAll(async () => {
  await prisma.$disconnect();
  cleanupTestDb(dbFile);
});

const realFetch = global.fetch;
let fetchMock: any;

beforeEach(async () => {
  await wipeAll(prisma);
  fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
  global.fetch = fetchMock as any;
});

afterEach(() => {
  global.fetch = realFetch;
});

function makeSub(overrides: Record<string, unknown> = {}) {
  return prisma.webhookSubscription.create({
    data: {
      name: "test-hook",
      url: "https://example.test/hook",
      secret: newWebhookSecret(),
      events: JSON.stringify(["*"]),
      ...overrides,
    },
  });
}

describe("signPayload", () => {
  it("produces sha256=<hmac hex> verifiable with the secret", () => {
    const sig = signPayload("whsec_abc", '{"hello":"world"}');
    const expected = `sha256=${crypto.createHmac("sha256", "whsec_abc").update('{"hello":"world"}').digest("hex")}`;
    expect(sig).toBe(expected);
  });
});

describe("subscriptionMatches", () => {
  it("wildcard matches everything", () => {
    expect(subscriptionMatches('["*"]', "incident.declared")).toBe(true);
  });
  it("explicit list matches only listed events", () => {
    expect(subscriptionMatches('["incident.resolved"]', "incident.resolved")).toBe(true);
    expect(subscriptionMatches('["incident.resolved"]', "incident.declared")).toBe(false);
  });
  it("invalid JSON never matches", () => {
    expect(subscriptionMatches("not-json", "incident.declared")).toBe(false);
  });
});

describe("emitWebhookEvent", () => {
  it("delivers to matching active subscriptions with a valid signature", async () => {
    const sub = await makeSub();
    const deliveries = await emitWebhookEvent("incident.declared", { incident: "INC-1" });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("success");
    expect(deliveries[0].statusCode).toBe(200);
    expect(deliveries[0].durationMs).not.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/hook");
    expect(init.headers["x-incidently-event"]).toBe("incident.declared");
    expect(init.headers["x-incidently-signature"]).toBe(signPayload(sub.secret, init.body));
    const parsed = JSON.parse(init.body);
    expect(parsed.event).toBe("incident.declared");
    expect(parsed.data.incident).toBe("INC-1");
  });

  it("skips paused subscriptions and non-matching event filters", async () => {
    await makeSub({ active: false });
    await makeSub({ name: "resolved-only", events: JSON.stringify(["incident.resolved"]) });
    const deliveries = await emitWebhookEvent("incident.declared", {});
    expect(deliveries).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.webhookDelivery.count()).toBe(0);
  });

  it("records a failed delivery when the endpoint errors", async () => {
    await makeSub();
    fetchMock.mockImplementation(async () => new Response("nope", { status: 500 }));
    const [delivery] = await emitWebhookEvent("incident.declared", {});
    expect(delivery.status).toBe("failed");
    expect(delivery.statusCode).toBe(500);
    expect(delivery.error).toBe("HTTP 500");
  });

  it("records a failed delivery when fetch throws", async () => {
    await makeSub();
    fetchMock.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });
    const [delivery] = await emitWebhookEvent("incident.declared", {});
    expect(delivery.status).toBe("failed");
    expect(delivery.error).toContain("ECONNREFUSED");
    expect(delivery.statusCode).toBeNull();
  });
});

describe("sendTestDelivery", () => {
  it("pings a subscription regardless of its event filter", async () => {
    const sub = await makeSub({ events: JSON.stringify(["incident.resolved"]) });
    const delivery = await sendTestDelivery(sub.id);
    expect(delivery.event).toBe("ping");
    expect(delivery.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("redeliver", () => {
  it("re-sends the exact original payload as a new delivery", async () => {
    await makeSub();
    const [first] = await emitWebhookEvent("incident.declared", { incident: "INC-2" });
    const second = await redeliver(first.id);

    expect(second.id).not.toBe(first.id);
    expect(second.payload).toBe(first.payload);
    expect(second.status).toBe("success");
    expect(await prisma.webhookDelivery.count()).toBe(2);
    expect(fetchMock.mock.calls[1][1].body).toBe(first.payload);
  });
});

describe("incidentSnapshot", () => {
  it("serializes the API-friendly shape", () => {
    const snap = incidentSnapshot(
      {
        number: 42,
        title: "T",
        severity: "sev2",
        status: "investigating",
        declaredAt: new Date("2026-08-12T00:00:00Z"),
        resolvedAt: null,
      },
      "Payments Pipeline",
    );
    expect(snap).toEqual({
      incident: "INC-42",
      title: "T",
      severity: "sev2",
      status: "investigating",
      service: "Payments Pipeline",
      declared_at: "2026-08-12T00:00:00.000Z",
      resolved_at: null,
    });
  });
});
