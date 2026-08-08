import { test, expect } from "@playwright/test";

test.describe.serial("runbooks", () => {
  test("create a runbook with markdown preview", async ({ page }) => {
    await page.goto("/runbooks");
    await expect(page.getByText("Payments Pipeline: elevated error rates")).toBeVisible();

    await page.getByRole("link", { name: "+ New runbook" }).click();
    await page.getByPlaceholder(/Runbook title/).fill("E2E: internal tools restart");
    await page.locator("select").selectOption({ label: "Internal Tooling" });
    await page
      .locator("textarea")
      .fill("# Restart procedure\n\n## Steps\n1. Run `toolctl restart`\n2. Verify **dashboard** loads");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/runbooks\/(?!new)/);

    // after the URL swap the editor may remount straight into preview mode;
    // click Preview only if the editor is still in edit mode
    await page.waitForTimeout(800);
    const previewBtn = page.getByRole("button", { name: "Preview" });
    if (await previewBtn.isVisible().catch(() => false)) await previewBtn.click();
    await expect(page.getByRole("heading", { name: "Restart procedure" })).toBeVisible();
    await expect(page.locator("code", { hasText: "toolctl restart" })).toBeVisible();
  });

  test("runbook is surfaced inside incidents for its service", async ({ page }) => {
    await page.goto("/incidents/declare");
    await page.getByPlaceholder(/Elevated error rates/).fill("E2E: tooling hiccup");
    await page.getByRole("button", { name: /SEV4/ }).click();
    await page.locator("select").first().selectOption({ label: "Internal Tooling (Tier 3)" });
    await page.getByRole("button", { name: "Declare incident" }).click();
    await page.waitForURL(/\/incidents\/(?!declare)/);

    await expect(page.getByText(/Runbooks for Internal Tooling/)).toBeVisible();
    await page.getByRole("link", { name: /internal tools restart/ }).click();
    await page.waitForURL(/\/runbooks\//);
    await expect(page.getByRole("heading", { name: "Restart procedure" })).toBeVisible();
  });
});
