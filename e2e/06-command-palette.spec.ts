import { test, expect } from "@playwright/test";

test.describe("command palette", () => {
  test("opens with Ctrl+K and shows quick actions", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/Search incidents/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Declare an incident/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Who is on call/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/Search incidents/)).toHaveCount(0);
  });

  test("finds an incident by number and navigates on Enter", async ({ page }) => {
    await page.goto("/analytics");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search incidents/).fill("1006");
    await expect(page.getByRole("button", { name: /INC-1006/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/incidents\//);
    await expect(page.getByText("INC-1006").first()).toBeVisible();
  });

  test("finds services and runbooks by name", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search incidents/).fill("comms cadence");
    await expect(page.getByRole("button", { name: /comms cadence/ })).toBeVisible();

    await page.getByPlaceholder(/Search incidents/).fill("Payments");
    await expect(page.getByRole("button", { name: /Payments Pipeline/ }).first()).toBeVisible();
  });
});
