import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Alert pipeline through the browser + the real webhook.
test.describe.serial("alerts", () => {
  let token = "";

  test.beforeAll(async ({ request }) => {
    // Visiting the alerts API surface lazily creates the ingest token.
    await request.get("/alerts");
    const prisma = new PrismaClient();
    token = (await prisma.setting.findUniqueOrThrow({ where: { key: "ingest_token" } })).value;
    await prisma.$disconnect();
  });

  test("feed shows seeded alerts with dedup counters and incident links", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
    await expect(page.getByText("P95 latency above 800ms on search queries")).toBeVisible();
    await expect(page.getByText("×3")).toBeVisible(); // dedup counter
    await expect(page.getByText("×7")).toBeVisible();
    await expect(page.getByRole("link", { name: /→ INC-1006/ })).toBeVisible(); // attached alert
  });

  test("webhook setup shows the curl snippet with the real token", async ({ page }) => {
    await page.goto("/alerts");
    await page.getByRole("button", { name: "Webhook setup" }).click();
    await expect(page.locator("pre")).toContainText("/api/ingest");
    await expect(page.locator("pre")).toContainText(token);
  });

  test("test-warning button creates an alert in the feed", async ({ page }) => {
    await page.goto("/alerts");
    await page.getByRole("button", { name: /Test warning/ }).click();
    await expect(page.getByText(/Alert created in the feed|Duplicate alert deduplicated/)).toBeVisible();
  });

  test("critical webhook alert on a free tier-1 service auto-declares and links", async ({ page, request }) => {
    const res = await request.post("/api/ingest", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: "E2E: web app hard down",
        description: "Synthetic critical from the E2E suite",
        severity: "critical",
        service: "web-app",
        dedup_key: "e2e-webapp-down",
        source: "grafana",
      },
    });
    const body = await res.json();
    expect(body.action).toBe("incident_declared");

    await page.goto("/alerts");
    const row = page.locator("div.card", { hasText: "E2E: web app hard down" }).first();
    await expect(row.getByRole("link", { name: /→ INC-\d+/ })).toBeVisible();

    // follow it into the incident room: auto-declare noted on the timeline
    await row.getByRole("link", { name: /→ INC-\d+/ }).click();
    await expect(page.getByText(/Incident auto-declared from grafana alert/)).toBeVisible();
    await expect(page.getByText(/Paged level 1/)).toBeVisible();
  });

  test("promote a warning alert to an incident from the feed", async ({ page, request }) => {
    await request.post("/api/ingest", {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "E2E: promote me", severity: "warning", service: "search", dedup_key: "e2e-promote" },
    });
    await page.goto("/alerts");
    const row = page.locator("div.card", { hasText: "E2E: promote me" }).first();
    await row.getByRole("button", { name: "Promote to incident" }).click();
    await expect(row.getByRole("link", { name: /→ INC-\d+/ })).toBeVisible();
  });

  test("ack and resolve from the feed", async ({ page, request }) => {
    await request.post("/api/ingest", {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "E2E: ack me", severity: "info", dedup_key: "e2e-ack" },
    });
    await page.goto("/alerts");
    const row = page.locator("div.card", { hasText: "E2E: ack me" }).first();
    await row.getByRole("button", { name: "Ack", exact: true }).click();
    await expect(row.getByText("Acked")).toBeVisible();
    await row.getByRole("button", { name: "Resolve", exact: true }).click();
    // moves into the "Recently resolved" section
    await expect(
      page.locator("section", { hasText: "Recently resolved" }).getByText("E2E: ack me"),
    ).toBeVisible();
  });
});
