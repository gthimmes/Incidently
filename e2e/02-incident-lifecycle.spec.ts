import { test, expect } from "@playwright/test";

// The full journey: declare → page → ack → investigate → note → update →
// action item → Jira → resolve → auto-postmortem → edit postmortem.
// Serial: each step builds on the previous one.
test.describe.serial("incident lifecycle", () => {
  let incidentUrl = "";

  test("declare a SEV1 with service pages on-call instantly", async ({ page }) => {
    await page.goto("/incidents/declare");

    await page.getByPlaceholder(/Elevated error rates/).fill("E2E: gateway meltdown");
    await page.getByPlaceholder(/What do we know so far/).fill("Synthetic incident from the E2E suite.");
    await page.getByRole("button", { name: /SEV1/ }).click();
    await page.locator("select").first().selectOption({ label: "Public API (Tier 1)" });
    await page.getByRole("button", { name: "Declare incident" }).click();

    await page.waitForURL(/\/incidents\/(?!declare)/);
    incidentUrl = page.url();

    await expect(page.getByRole("heading", { name: "E2E: gateway meltdown" })).toBeVisible();
    await expect(page.getByText("Paged level 1: Maya Rodriguez (SMS · voice · email · push)")).toBeVisible();
    await expect(page.getByText("Awaiting ack")).toBeVisible();
    // runbook for Public API surfaced automatically
    await expect(page.getByRole("link", { name: /gateway 5xx \/ health-check failures/ })).toBeVisible();
  });

  test("acknowledge the page", async ({ page }) => {
    await page.goto(incidentUrl);
    await page.getByRole("button", { name: "Ack", exact: true }).click();
    await expect(page.getByText("Maya Rodriguez acknowledged the page")).toBeVisible();
    // the page status inside the Pages panel flips to Acknowledged
    await expect(
      page.locator("section", { hasText: "Pages" }).getByText("Acknowledged", { exact: true }),
    ).toBeVisible();
  });

  test("advance status and add a timeline note", async ({ page }) => {
    await page.goto(incidentUrl);
    await page.getByRole("button", { name: "Investigating" }).click();
    await expect(page.getByText("Status changed: Triage → Investigating")).toBeVisible();

    await page.getByPlaceholder(/Add a note to the timeline/).fill("Rolled back the config deploy");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Rolled back the config deploy")).toBeVisible();
  });

  test("publish a status update that reaches the public status page", async ({ page }) => {
    await page.goto(incidentUrl);
    await page.getByRole("button", { name: /Publish update/ }).click();
    await page.getByPlaceholder(/What should stakeholders/).fill("Fix applied, monitoring recovery.");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Fix applied, monitoring recovery.")).toBeVisible();

    await page.goto("/status");
    await expect(page.getByText("E2E: gateway meltdown")).toBeVisible();
    await expect(page.getByText("Fix applied, monitoring recovery.")).toBeVisible();
    // SEV1 on Public API flips the banner + component row
    await expect(page.getByText("Major Outage").first()).toBeVisible();
  });

  test("create an action item and push it to Jira (mock mode)", async ({ page }) => {
    await page.goto(incidentUrl);
    await page.getByRole("button", { name: "+ Add" }).click();
    await page.getByPlaceholder("What needs to happen?").fill("E2E remediation item");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("E2E remediation item", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Push to Jira/ }).click();
    await expect(page.locator("a", { hasText: /^OPS-\d+$/ }).first()).toBeVisible();
    await expect(page.getByText(/Jira issue OPS-\d+ created/)).toBeVisible();
  });

  test("resolve: pages settle, postmortem auto-created, service restored", async ({ page }) => {
    await page.goto(incidentUrl);
    await page.getByRole("button", { name: /✓ Resolve/ }).click();
    await expect(page.getByText("Resolved — nice work.")).toBeVisible();
    await expect(page.getByText("Postmortem draft created automatically (required for SEV0–SEV2)")).toBeVisible();

    // service back to operational on the status page (payments still degraded from INC-1006)
    await page.goto("/services");
    const apiCard = page.locator("div.card", { hasText: "Public API" }).first();
    await expect(apiCard.getByText("Operational")).toBeVisible();
  });

  test("edit and submit the auto-created postmortem", async ({ page }) => {
    await page.goto(incidentUrl);
    await page.getByRole("link", { name: /View postmortem/ }).click();
    await page.waitForURL(/\/postmortems\//);

    await expect(page.getByRole("heading", { name: "E2E: gateway meltdown" })).toBeVisible();
    // the remediation item flows into the postmortem
    await expect(page.getByText("E2E remediation item", { exact: true })).toBeVisible();

    const rootCause = page.locator("section", { hasText: "Root cause" }).locator("textarea");
    await rootCause.fill("A bad config deploy took out the gateway.");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("In Review")).toBeVisible();

    // shows up in the postmortem list with its new status
    await page.goto("/postmortems");
    const row = page.locator("a", { hasText: "E2E: gateway meltdown" }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("In Review")).toBeVisible();
  });

  test("incident appears under the Resolved filter", async ({ page }) => {
    await page.goto("/incidents?filter=resolved");
    await expect(page.getByRole("link", { name: /E2E: gateway meltdown/ })).toBeVisible();
    await page.goto("/incidents?filter=open");
    await expect(page.getByRole("link", { name: /E2E: gateway meltdown/ })).toHaveCount(0);
  });
});
