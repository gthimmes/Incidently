import { test, expect } from "@playwright/test";

// The in-app help center (help-navigator widget mounted in the root layout).
// Playwright locators pierce the widget's shadow root automatically.
test.describe.serial("help center", () => {
  test("launcher opens contextual help on the dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open help" }).click();

    const panel = page.getByRole("dialog", { name: "Incidently Help" });
    await expect(panel.getByText("Suggested for this page")).toBeVisible();
    await expect(panel.getByText("Reading the dashboard")).toBeVisible();
    await expect(panel.getByText("Browse by topic")).toBeVisible();
    await expect(panel.getByText("On-call & escalation")).toBeVisible();
  });

  test("context follows the route", async ({ page }) => {
    await page.goto("/alerts");
    await page.getByRole("button", { name: "Open help" }).click();
    const panel = page.getByRole("dialog", { name: "Incidently Help" });
    await expect(panel.getByText("Triaging the Alerts feed")).toBeVisible();
    await expect(panel.getByText("Promotion rules: alerts that declare themselves")).toBeVisible();
  });

  test("F1 toggles the panel and Esc closes it", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("F1");
    const panel = page.getByRole("dialog", { name: "Incidently Help" });
    await expect(panel.getByText("Browse by topic")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel.getByText("Browse by topic")).not.toBeVisible();
  });

  test("search finds articles and renders them with markdown", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open help" }).click();
    const panel = page.getByRole("dialog", { name: "Incidently Help" });

    await panel.getByPlaceholder("Search help articles…").fill("escalation");
    await expect(panel.locator("mark").first()).toBeVisible();

    await panel.getByRole("button", { name: /Escalation policies & auto-escalation/ }).click();
    await expect(
      panel.getByRole("heading", { name: "Escalation policies & auto-escalation" }),
    ).toBeVisible();
    await expect(panel.getByText("Manual escalation")).toBeVisible();

    // related articles + feedback affordances render
    await expect(panel.getByText("Was this article helpful?")).toBeVisible();
    await expect(panel.getByText("Related articles")).toBeVisible();
  });

  test("category drill-down and back navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open help" }).click();
    const panel = page.getByRole("dialog", { name: "Incidently Help" });

    await panel.getByRole("button", { name: /Alerts & ingestion/ }).click();
    await expect(panel.getByText("Ingesting alerts from your monitoring tools")).toBeVisible();

    await panel.getByRole("button", { name: /Ingesting alerts/ }).click();
    await expect(panel.getByRole("heading", { name: "Ingesting alerts from your monitoring tools" })).toBeVisible();
    await expect(panel.locator("pre").first()).toBeVisible(); // code block renders

    await panel.getByRole("button", { name: "Back" }).click();
    await panel.getByRole("button", { name: "Back" }).click();
    await expect(panel.getByText("Browse by topic")).toBeVisible();
  });

  test("feedback buttons work", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open help" }).click();
    const panel = page.getByRole("dialog", { name: "Incidently Help" });
    await panel.getByPlaceholder("Search help articles…").fill("postmortem");
    await panel.getByRole("button", { name: /Writing a blameless postmortem/ }).first().click();
    await panel.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(panel.getByText("Thanks for the feedback!")).toBeVisible();
  });
});
