import { test, expect } from "@playwright/test";

// Sprint 5 response automation: severity checklists + outbound webhooks.
test.describe.serial("response automation", () => {
  test("live incident shows its response checklist; ticking updates progress and timeline", async ({ page }) => {
    await page.goto("/incidents");
    await page.getByRole("link", { name: /Elevated error rates on Payments Pipeline/ }).click();

    // seeded SEV2 checklist arrives 3/6 done
    await expect(page.getByText("Response checklist", { exact: true })).toBeVisible();
    await expect(page.getByText("3/6", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Check for a recent deploy or config change/ }).click();
    await expect(page.getByText("4/6", { exact: true })).toBeVisible();
    await expect(page.getByText(/Checklist: “Check for a recent deploy/)).toBeVisible();
  });

  test("settings lists the seeded webhook with its delivery log; test ping succeeds", async ({ page }) => {
    await page.goto("/settings");
    const card = page.getByTestId("hook-Ops event bus");
    await expect(card).toBeVisible();
    await expect(card.getByText("incident.declared", { exact: true }).first()).toBeVisible();

    await card.getByRole("button", { name: "Send test" }).click();
    await expect(card.getByText("ping", { exact: true }).first()).toBeVisible();
    // newest delivery row is the ping and it succeeded against /api/dev/echo
    await expect(card.getByText("✓").first()).toBeVisible();
  });

  test("create a webhook — signing secret shown once — then pause and delete it", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "+ Add webhook" }).click();
    await page.getByPlaceholder(/Name, e.g/).fill("e2e-hook");
    await page.getByPlaceholder(/hooks\/incidently/).fill("http://localhost:3000/api/dev/echo");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText(/Webhook "e2e-hook" added/)).toBeVisible();
    const secret = await page.locator("code", { hasText: /^whsec_/ }).first().innerText();
    expect(secret).toMatch(/^whsec_[0-9a-f]{48}$/);
    await page.getByRole("button", { name: "Done" }).click();

    const card = page.getByTestId("hook-e2e-hook");
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Pause" }).click();
    await expect(card.getByRole("button", { name: "Resume" })).toBeVisible();

    await card.getByRole("button", { name: "Delete" }).click();
    await expect(card).not.toBeVisible();
  });

  test("declaring an incident fans out to active webhooks", async ({ page }) => {
    // declare through the UI-equivalent API, then watch the delivery land in settings
    const res = await page.request.post("/api/incidents", {
      data: { title: "E2E webhook fan-out incident", severity: "sev4" },
    });
    expect(res.status()).toBe(201);

    await page.goto("/settings");
    const card = page.getByTestId("hook-Ops event bus");
    const newest = card.locator("div.font-mono").first();
    await expect(newest).toContainText("incident.declared");
    await expect(newest.getByText("✓")).toBeVisible();
  });
});
