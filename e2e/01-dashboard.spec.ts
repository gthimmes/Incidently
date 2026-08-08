import { test, expect } from "@playwright/test";

test.describe("dashboard", () => {
  test("shows stats, the live incident, on-call, and service health", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // stat tiles
    for (const label of ["OPEN INCIDENTS", "MTTA · 30D", "MTTR · 30D", "RESOLVED · 30D"]) {
      await expect(page.getByText(label)).toBeVisible();
    }

    // seeded live incident
    await expect(
      page.getByRole("link", { name: /Elevated error rates on Payments Pipeline/ }),
    ).toBeVisible();

    // on-call rail resolves both schedules
    await expect(page.getByText("ON CALL NOW")).toBeVisible();
    await expect(page.getByText("Platform Primary")).toBeVisible();
    await expect(page.getByText("Platform Secondary")).toBeVisible();

    // service health shows the degraded payments service
    await expect(page.getByText("Degraded Performance")).toBeVisible();
  });

  test("declare button navigates to the declare form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Declare Incident" }).first().click();
    await expect(page).toHaveURL(/\/incidents\/declare/);
    await expect(page.getByRole("heading", { name: "Declare an incident" })).toBeVisible();
  });
});
