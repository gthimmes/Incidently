import { test, expect } from "@playwright/test";

test.describe("on-call", () => {
  test("shows schedules, current on-call, and the escalation policy chain", async ({ page }) => {
    await page.goto("/oncall");
    await expect(page.getByRole("heading", { name: "On-Call" })).toBeVisible();
    await expect(page.getByText("Platform Primary").first()).toBeVisible();
    await expect(page.getByText("Platform Secondary").first()).toBeVisible();
    await expect(page.getByText("On call now").first()).toBeVisible();

    await expect(page.getByText("LEVEL 1")).toBeVisible();
    await expect(page.getByText("LEVEL 2")).toBeVisible();
    await expect(page.getByText("LEVEL 3")).toBeVisible();
    await expect(page.getByText(/after 5m unacked/)).toBeVisible();
  });

  test("take an override: chosen user becomes on-call immediately", async ({ page }) => {
    await page.goto("/oncall");
    const primaryCard = page.locator("div.card", { hasText: "Platform Primary" }).first();

    await primaryCard.getByRole("button", { name: /Override/ }).click();
    await primaryCard.locator("select").first().selectOption({ label: "Sarah Chen" });
    await primaryCard.getByRole("button", { name: "Take override" }).click();

    await expect(primaryCard.getByText(/Sarah Chen is now on call/)).toBeVisible();
    // after refresh the card reflects the override
    await page.reload();
    const refreshed = page.locator("div.card", { hasText: "Platform Primary" }).first();
    await expect(refreshed.getByText("On call now")).toBeVisible();
    await expect(refreshed.getByText("Sarah Chen").first()).toBeVisible();
  });
});
