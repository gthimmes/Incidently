/**
 * Notification engine unit tests: provider selection, channel fan-out per
 * severity, Twilio adapter behavior (fetch mocked — nothing leaves the box).
 */
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { initTestDb, cleanupTestDb, wipeAll } from "./test-db";

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let send: any, pageUser: any;
let dbFile: string;

function clearTwilioEnv() {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
}

beforeAll(async () => {
  dbFile = initTestDb("notify");
  ({ prisma } = await import("@/lib/db"));
  ({ send, pageUser } = await import("@/lib/notify"));
});

afterAll(async () => {
  await prisma.$disconnect();
  cleanupTestDb(dbFile);
});

beforeEach(async () => {
  clearTwilioEnv();
  await wipeAll(prisma);
});

afterEach(() => {
  clearTwilioEnv();
  vi.unstubAllGlobals();
});

async function makeUser(overrides: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: { name: "Pat Page", email: "pat@test.dev", phone: "+15550001111", ...overrides },
  });
}

async function makeIncident(severity = "sev1") {
  return prisma.incident.create({
    data: { number: 9000 + Math.floor(Math.random() * 999), title: "Test incident", severity },
  });
}

describe("send()", () => {
  it("records a simulated notification when Twilio is not configured", async () => {
    const n = await send({ channel: "sms", recipient: "+15550001111", body: "hello" });
    expect(n.provider).toBe("simulator");
    expect(n.status).toBe("simulated");
    expect(await prisma.notification.count()).toBe(1);
  });

  it("uses Twilio for SMS when credentials are configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_FROM_NUMBER = "+15559998888";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const n = await send({ channel: "sms", recipient: "+15550001111", body: "page!" });
    expect(n.provider).toBe("twilio");
    expect(n.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("api.twilio.com");
    expect(url).toContain("AC123/Messages.json");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("AC123:tok").toString("base64")}`);
    const params = new URLSearchParams(init.body.toString());
    expect(params.get("To")).toBe("+15550001111");
    expect(params.get("From")).toBe("+15559998888");
    expect(params.get("Body")).toBe("page!");
  });

  it("uses Twilio voice with TTS TwiML and escapes markup", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_FROM_NUMBER = "+15559998888";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await send({ channel: "voice", recipient: "+15550001111", body: "alert <script> & co" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("Calls.json");
    const twiml = new URLSearchParams(init.body.toString()).get("Twiml")!;
    expect(twiml).toContain("&lt;script&gt;");
    expect(twiml).toContain("&amp; co");
    expect(twiml).not.toContain("<script>");
  });

  it("records failed status when Twilio rejects", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_FROM_NUMBER = "+15559998888";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const n = await send({ channel: "sms", recipient: "+15550001111", body: "x" });
    expect(n.status).toBe("failed");
    expect(n.provider).toBe("twilio");
  });

  it("email/slack/push always go through the simulator even with Twilio configured", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_FROM_NUMBER = "+15559998888";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const n = await send({ channel: "email", recipient: "x@y.dev", body: "x" });
    expect(n.provider).toBe("simulator");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pageUser()", () => {
  it("sev1 fans out to sms + voice + email + push", async () => {
    const user = await makeUser();
    const incident = await makeIncident("sev1");
    const page = await prisma.page.create({ data: { incidentId: incident.id, userId: user.id } });

    await pageUser({
      userId: user.id,
      incidentId: incident.id,
      pageId: page.id,
      severity: "sev1",
      incidentNumber: incident.number,
      title: incident.title,
    });

    const channels = (await prisma.notification.findMany()).map((n: any) => n.channel).sort();
    expect(channels).toEqual(["email", "push", "sms", "voice"]);
  });

  it("sev3 skips the voice call", async () => {
    const user = await makeUser();
    const incident = await makeIncident("sev3");
    const page = await prisma.page.create({ data: { incidentId: incident.id, userId: user.id } });

    await pageUser({
      userId: user.id,
      incidentId: incident.id,
      pageId: page.id,
      severity: "sev3",
      incidentNumber: incident.number,
      title: incident.title,
    });

    const channels = (await prisma.notification.findMany()).map((n: any) => n.channel).sort();
    expect(channels).toEqual(["email", "push", "sms"]);
  });

  it("a user without a phone still gets email + push", async () => {
    const user = await makeUser({ phone: null, email: "nophone@test.dev" });
    const incident = await makeIncident("sev1");
    const page = await prisma.page.create({ data: { incidentId: incident.id, userId: user.id } });

    await pageUser({
      userId: user.id,
      incidentId: incident.id,
      pageId: page.id,
      severity: "sev1",
      incidentNumber: incident.number,
      title: incident.title,
    });

    const channels = (await prisma.notification.findMany()).map((n: any) => n.channel).sort();
    expect(channels).toEqual(["email", "push"]);
  });

  it("notification body carries the incident number and severity", async () => {
    const user = await makeUser();
    const incident = await makeIncident("sev2");
    const page = await prisma.page.create({ data: { incidentId: incident.id, userId: user.id } });

    await pageUser({
      userId: user.id,
      incidentId: incident.id,
      pageId: page.id,
      severity: "sev2",
      incidentNumber: incident.number,
      title: incident.title,
    });

    const n = await prisma.notification.findFirst();
    expect(n.body).toContain(`INC-${incident.number}`);
    expect(n.body).toContain("SEV2");
    expect(n.pageId).toBe(page.id);
  });
});
