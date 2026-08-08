import { test, expect } from "@playwright/test";

test.describe("settings", () => {
  test("shows Jira and Twilio cards with their mode badges", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Jira Cloud")).toBeVisible();
    await expect(page.getByText("Mock mode", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("SMS & Voice — Twilio")).toBeVisible();
    await expect(page.getByText("Simulation mode", { exact: true })).toBeVisible();
    await expect(page.getByText("TWILIO_ACCOUNT_SID")).toBeVisible();
  });

  test("saves Jira settings and tests the connection in mock mode", async ({ page }) => {
    await page.goto("/settings");
    await page.getByPlaceholder("OPS").fill("OPS");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    await page.getByRole("button", { name: "Test connection" }).click();
    await expect(page.getByText(/Mock mode active/)).toBeVisible();
  });
});
