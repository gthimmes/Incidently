// Maps app routes to the help articles most relevant on that page.
// Shown as "Suggested for this page" when the help panel opens.

const ROUTE_HELP: Array<{ pattern: RegExp; articles: string[] }> = [
  { pattern: /^\/$/, articles: ["dashboard", "welcome", "command-palette"] },
  { pattern: /^\/incidents\/declare/, articles: ["declare-incident", "severity-levels"] },
  { pattern: /^\/incidents\/[^/]+/, articles: ["incident-room", "response-roles", "status-updates", "resolving-incidents"] },
  { pattern: /^\/incidents/, articles: ["declare-incident", "incident-room", "severity-levels"] },
  { pattern: /^\/alerts/, articles: ["alerts-feed", "alert-ingestion", "promotion-rules"] },
  { pattern: /^\/oncall/, articles: ["oncall-overview", "escalation-policies", "oncall-overrides"] },
  { pattern: /^\/notifications/, articles: ["notifications-feed", "notification-channels"] },
  { pattern: /^\/postmortems/, articles: ["postmortem-basics", "remediations-board"] },
  { pattern: /^\/remediations/, articles: ["remediations-board", "jira-integration"] },
  { pattern: /^\/runbooks/, articles: ["runbooks-guide", "services-catalog"] },
  { pattern: /^\/services/, articles: ["services-catalog", "maintenance-windows", "promotion-rules"] },
  { pattern: /^\/analytics/, articles: ["analytics-guide"] },
  { pattern: /^\/status/, articles: ["status-page", "status-updates", "maintenance-windows"] },
  { pattern: /^\/settings/, articles: ["api-keys", "jira-integration", "outbound-webhooks", "notification-channels"] },
];

export function helpArticlesFor(pathname: string): string[] {
  return ROUTE_HELP.find((r) => r.pattern.test(pathname))?.articles ?? ["welcome"];
}

// Exported for tests: every article id referenced by the map.
export function allMappedArticleIds(): string[] {
  return [...new Set(ROUTE_HELP.flatMap((r) => r.articles))];
}
