import { test, expect } from "@playwright/test";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe.serial("maintenance windows", () => {
  test("schedule an active window from the services page", async ({ page }) => {
    await page.goto("/services");
    await page.getByRole("button", { name: /Schedule maintenance/ }).click();

    await page.getByPlaceholder(/Database engine upgrade/).fill("E2E: mail relay upgrade");
    await page.locator("select").first().selectOption({ label: "Notification Service" });
    const inputs = page.locator('input[type="datetime-local"]');
    await inputs.nth(0).fill(toLocalInput(new Date(Date.now() - 5 * 60_000)));
    await inputs.nth(1).fill(toLocalInput(new Date(Date.now() + 2 * 3600_000)));
    await page.getByRole("button", { name: "Schedule", exact: true }).click();

    await expect(page.getByText("E2E: mail relay upgrade")).toBeVisible();
    await expect(page.getByText("in progress")).toBeVisible();
  });

  test("status page shows the window and the service reports Maintenance", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByText("Scheduled maintenance", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E: mail relay upgrade")).toBeVisible();

    // the component row for Notification Service now reports Maintenance
    await expect(page.getByText("Maintenance", { exact: true })).toBeVisible();
  });

  test("cancelling the window restores the service status", async ({ page }) => {
    await page.goto("/services");
    await page.getByRole("button", { name: "Cancel window" }).first().click();
    await expect(page.getByText("E2E: mail relay upgrade")).toHaveCount(0);

    await page.goto("/status");
    await expect(page.getByText("E2E: mail relay upgrade")).toHaveCount(0);
  });
});
