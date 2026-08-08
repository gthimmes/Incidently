/**
 * Jira client unit tests: mock-mode issue creation, config persistence,
 * real-mode REST calls (fetch mocked — nothing leaves the box).
 */
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { initTestDb, cleanupTestDb, wipeAll } from "./test-db";

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let getJiraConfig: any, saveJiraConfig: any, createJiraIssue: any, testJiraConnection: any;
let dbFile: string;

beforeAll(async () => {
  dbFile = initTestDb("jira");
  ({ prisma } = await import("@/lib/db"));
  ({ getJiraConfig, saveJiraConfig, createJiraIssue, testJiraConnection } = await import("@/lib/jira"));
});

afterAll(async () => {
  await prisma.$disconnect();
  cleanupTestDb(dbFile);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("config", () => {
  it("returns safe defaults (mock mode) with no stored config", async () => {
    const cfg = await getJiraConfig();
    expect(cfg.mockMode).toBe(true);
    expect(cfg.projectKey).toBe("OPS");
  });

  it("saves partial updates without losing other fields", async () => {
    await saveJiraConfig({ baseUrl: "https://x.atlassian.net", email: "a@b.c" });
    await saveJiraConfig({ projectKey: "ENG" });
    const cfg = await getJiraConfig();
    expect(cfg.baseUrl).toBe("https://x.atlassian.net");
    expect(cfg.email).toBe("a@b.c");
    expect(cfg.projectKey).toBe("ENG");
  });
});

describe("mock mode", () => {
  it("creates issues with sequential keys in the configured project", async () => {
    await saveJiraConfig({ projectKey: "OPS", mockMode: true });
    const first = await createJiraIssue({ summary: "Fix the thing", description: "d" });
    const second = await createJiraIssue({ summary: "Fix the other thing", description: "d" });
    const n1 = parseInt(first.key.split("-")[1], 10);
    const n2 = parseInt(second.key.split("-")[1], 10);
    expect(first.key).toMatch(/^OPS-\d+$/);
    expect(n2).toBe(n1 + 1);
    expect(first.url).toContain(`/browse/${first.key}`);
    expect(first.status).toBe("To Do");
  });

  it("test connection succeeds without any credentials", async () => {
    const result = await testJiraConnection();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Mock mode");
  });
});

describe("real mode (fetch mocked)", () => {
  const realCfg = {
    mockMode: false,
    baseUrl: "https://real.atlassian.net",
    email: "ops@corp.dev",
    apiToken: "secret-token",
    projectKey: "OPS",
  };

  it("POSTs to the REST v3 issue endpoint with basic auth", async () => {
    await saveJiraConfig(realCfg);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key: "OPS-777" }) });
    vi.stubGlobal("fetch", fetchMock);

    const issue = await createJiraIssue({ summary: "Real ticket", description: "details" });
    expect(issue.key).toBe("OPS-777");
    expect(issue.url).toBe("https://real.atlassian.net/browse/OPS-777");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://real.atlassian.net/rest/api/3/issue");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("ops@corp.dev:secret-token").toString("base64")}`,
    );
    const body = JSON.parse(init.body);
    expect(body.fields.project.key).toBe("OPS");
    expect(body.fields.summary).toBe("Real ticket");
  });

  it("throws a descriptive error when Jira rejects the create", async () => {
    await saveJiraConfig(realCfg);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "no permission" }),
    );
    await expect(createJiraIssue({ summary: "x", description: "y" })).rejects.toThrow(/403/);
  });

  it("test connection reports the connected user", async () => {
    await saveJiraConfig(realCfg);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ displayName: "Ops Bot" }) }),
    );
    const result = await testJiraConnection();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Ops Bot");
  });

  it("test connection surfaces auth failures without throwing", async () => {
    await saveJiraConfig(realCfg);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const result = await testJiraConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});
