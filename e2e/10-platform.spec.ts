import { test, expect } from "@playwright/test";

// Sprint 4 platform features: SLO bars, API keys, CSV export.
test.describe.serial("platform", () => {
  test("services show SLO error-budget bars with burn", async ({ page }) => {
    await page.goto("/services");
    // seeded payments incidents have blown the 99.9% budget
    const paymentsCard = page.locator("div.card", { hasText: "Payments Pipeline" }).first();
    await expect(paymentsCard.getByText(/SLO 99\.9% · 30d error budget/)).toBeVisible();
    await expect(paymentsCard.getByText(/% burned/)).toBeVisible();
    await expect(paymentsCard.getByText(/of budget left/)).toBeVisible();
  });

  test("a service without an SLO can get one set inline", async ({ page }) => {
    await page.goto("/services");
    const toolingCard = page.locator("div.card", { hasText: "Internal Tooling" }).first();
    await expect(toolingCard.getByText("No SLO set")).toBeVisible();
    await toolingCard.locator("select").selectOption({ label: "99.5%" });
    await expect(toolingCard.getByText(/SLO 99\.5% · 30d error budget/)).toBeVisible();
  });

  test("create an API key in settings — token shown once, then revoke", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "+ Create key" }).click();
    await page.getByPlaceholder(/Key name/).fill("e2e-robot");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByText(/Key "e2e-robot" created/)).toBeVisible();
    const token = await page.locator("code", { hasText: /^ink_live_/ }).first().innerText();
    expect(token).toMatch(/^ink_live_[0-9a-f]{40}$/);
    await page.getByRole("button", { name: "Done" }).click();

    // listed with prefix only
    await expect(page.getByText(`${token.slice(0, 12)}…`)).toBeVisible();

    // the key actually works against v1
    const res = await page.request.get("/api/v1/oncall", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);

    // revoke kills it (the reseeded db has only this key)
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Revoked").first()).toBeVisible();
    const after = await page.request.get("/api/v1/oncall", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(after.status()).toBe(401);
  });

  test("incidents page offers a CSV export that downloads", async ({ page }) => {
    await page.goto("/incidents");
    await expect(page.getByRole("link", { name: /Export CSV/ })).toBeVisible();
    const res = await page.request.get("/api/export/incidents");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("INC-1001");
  });
});
