import { test, expect } from "@playwright/test";

// The read-only surfaces: status page, notifications feed, analytics,
// services catalog, remediations board.
test.describe("surfaces", () => {
  test("public status page shows banner, components, and active incidents", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByRole("heading", { name: "Aiwyn System Status" })).toBeVisible();
    // seeded payments incident keeps the page in a non-operational state
    await expect(page.getByText("Elevated error rates on Payments Pipeline")).toBeVisible();
    await expect(page.getByText("COMPONENTS")).toBeVisible();
    for (const svc of ["Public API", "Payments Pipeline", "Web Application"]) {
      await expect(page.getByText(svc, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Powered by Incidently")).toBeVisible();
  });

  test("notifications feed shows multi-channel deliveries in simulation mode", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByText("Simulation mode — zero cost.")).toBeVisible();
    for (const channel of ["SMS", "Voice call", "Email", "Push"]) {
      await expect(page.getByText(channel, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("simulated").first()).toBeVisible();
  });

  test("analytics renders stat tiles and all four charts", async ({ page }) => {
    await page.goto("/analytics");
    // labels are uppercased by CSS; DOM text keeps original casing
    for (const label of ["Incidents · 12w", "MTTA", "MTTR", "High-sev share"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    for (const chart of ["Incidents per week", "MTTR trend", "By severity", "By service", "On-call load"]) {
      await expect(page.getByRole("heading", { name: chart })).toBeVisible();
    }
    // seeded historical pages give the on-call load chart data
    const loadSection = page.locator("section", { hasText: "On-call load" });
    await expect(loadSection.getByText(/James Okafor|Maya Rodriguez|Dev Patel/).first()).toBeVisible();
    // SVG charts actually rendered
    expect(await page.locator("svg rect[rx='4']").count()).toBeGreaterThan(0); // bars
    expect(await page.locator("svg path[stroke]").count()).toBeGreaterThan(0); // trend line
  });

  test("services catalog shows tiers, escalation policies, and incident counts", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
    await expect(page.getByText("Tier 1 · Critical").first()).toBeVisible();
    await expect(page.getByText(/Escalation:/).first()).toBeVisible();
    await expect(page.getByText(/active incident/).first()).toBeVisible();
  });

  test("remediations board shows the three columns with Jira-linked cards", async ({ page }) => {
    await page.goto("/remediations");
    for (const col of ["Open", "In Progress", "Done"]) {
      await expect(page.getByRole("heading", { name: col })).toBeVisible();
    }
    await expect(page.locator("a", { hasText: /^OPS-\d+$/ }).first()).toBeVisible();
  });
});
