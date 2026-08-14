import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSearchIndex } from "help-navigator";
import { helpContent } from "@/lib/help/content";
import { allMappedArticleIds, helpArticlesFor } from "@/lib/help/context";

// Integration between the help corpus, the route-context map, the real app
// route tree, and the widget's search engine.
describe("help route context", () => {
  const articleIds = new Set(helpContent.articles.map((a) => a.id));

  it("every article id in the route map exists in the content", () => {
    for (const id of allMappedArticleIds()) {
      expect(articleIds.has(id), `route map references unknown article "${id}"`).toBe(true);
    }
  });

  it("every top-level app route has a curated context (not the fallback)", () => {
    const appDir = join(__dirname, "..", "..", "app");
    const routes = readdirSync(appDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "api")
      .filter((d) => existsSync(join(appDir, d.name, "page.tsx")))
      .map((d) => `/${d.name}`);
    expect(routes.length).toBeGreaterThan(5);
    for (const route of [...routes, "/"]) {
      const articles = helpArticlesFor(route);
      expect(articles.length, `route ${route} has no help context`).toBeGreaterThan(0);
      expect(articles, `route ${route} fell through to the generic fallback`).not.toEqual(["welcome"]);
    }
  });

  it("incident detail pages get incident-room help", () => {
    expect(helpArticlesFor("/incidents/abc123")).toContain("incident-room");
    expect(helpArticlesFor("/incidents/declare")).toContain("declare-incident");
  });

  it("unknown routes fall back to the welcome article", () => {
    expect(helpArticlesFor("/no-such-page")).toEqual(["welcome"]);
  });
});

describe("help search over the real corpus", () => {
  const index = createSearchIndex(
    helpContent.articles.map((a) => ({ id: a.id, title: a.title, body: a.body, tags: a.tags })),
  );

  const expectations: Array<[query: string, expectedId: string]> = [
    ["escalation policy", "escalation-policies"],
    ["twilio sms", "notification-channels"],
    ["jira", "jira-integration"],
    ["postmortem", "postmortem-basics"],
    ["dedup", "alert-ingestion"],
    ["severity", "severity-levels"],
    ["runbook", "runbooks-guide"],
    ["override shift", "oncall-overrides"],
    ["status page", "status-page"],
    ["mttr", "analytics-guide"],
  ];

  for (const [query, expectedId] of expectations) {
    it(`"${query}" surfaces ${expectedId} near the top`, () => {
      const top = index.search(query, 3).map((r) => r.id);
      expect(top, `query "${query}" returned ${JSON.stringify(top)}`).toContain(expectedId);
    });
  }

  it("prefix search works for search-as-you-type", () => {
    expect(index.search("escal").map((r) => r.id)).toContain("escalation-policies");
  });
});
