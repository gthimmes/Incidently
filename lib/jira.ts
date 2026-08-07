// Jira Cloud integration.
//
// Real REST v3 client, configured from Settings (site URL + email + API
// token). When unconfigured — or when "mock mode" is on — a built-in mock
// Jira backs the same interface so the whole flow is demoable end-to-end
// without credentials: created "issues" get realistic keys and a fake board.

import { prisma } from "./db";

export interface JiraConfig {
  baseUrl: string; // https://yourcompany.atlassian.net
  email: string;
  apiToken: string;
  projectKey: string; // e.g. OPS
  mockMode: boolean;
}

export interface JiraIssue {
  key: string;
  url: string;
  summary: string;
  status: string;
}

const DEFAULT_CONFIG: JiraConfig = {
  baseUrl: "",
  email: "",
  apiToken: "",
  projectKey: "OPS",
  mockMode: true,
};

export async function getJiraConfig(): Promise<JiraConfig> {
  const row = await prisma.setting.findUnique({ where: { key: "jira" } });
  if (!row) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...JSON.parse(row.value) };
}

export async function saveJiraConfig(cfg: Partial<JiraConfig>) {
  const current = await getJiraConfig();
  const next = { ...current, ...cfg };
  await prisma.setting.upsert({
    where: { key: "jira" },
    create: { key: "jira", value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

function authHeader(cfg: JiraConfig) {
  return `Basic ${Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64")}`;
}

// ─── Mock backend ───────────────────────────────────────────────────────────

async function nextMockIssueNumber(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: "jira_mock_counter" } });
  const n = row ? parseInt(row.value, 10) + 1 : 101;
  await prisma.setting.upsert({
    where: { key: "jira_mock_counter" },
    create: { key: "jira_mock_counter", value: String(n) },
    update: { value: String(n) },
  });
  return n;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function createJiraIssue(opts: {
  summary: string;
  description: string;
  issueType?: string;
}): Promise<JiraIssue> {
  const cfg = await getJiraConfig();

  if (cfg.mockMode || !cfg.baseUrl) {
    const n = await nextMockIssueNumber();
    const key = `${cfg.projectKey}-${n}`;
    return {
      key,
      url: `${cfg.baseUrl || "https://mock.atlassian.net"}/browse/${key}`,
      summary: opts.summary,
      status: "To Do",
    };
  }

  const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: cfg.projectKey },
        summary: opts.summary,
        issuetype: { name: opts.issueType ?? "Task" },
        description: {
          type: "doc",
          version: 1,
          content: [
            { type: "paragraph", content: [{ type: "text", text: opts.description }] },
          ],
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Jira issue creation failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { key: string };
  return {
    key: data.key,
    url: `${cfg.baseUrl}/browse/${data.key}`,
    summary: opts.summary,
    status: "To Do",
  };
}

export async function testJiraConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await getJiraConfig();
  if (cfg.mockMode || !cfg.baseUrl) {
    return { ok: true, message: "Mock mode active — no real Jira connection needed." };
  }
  try {
    const res = await fetch(`${cfg.baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: authHeader(cfg) },
    });
    if (!res.ok) return { ok: false, message: `Jira responded ${res.status}` };
    const me = (await res.json()) as { displayName?: string };
    return { ok: true, message: `Connected as ${me.displayName ?? "unknown user"}` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${String(e)}` };
  }
}
