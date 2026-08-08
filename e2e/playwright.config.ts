import { defineConfig } from "@playwright/test";

// E2E suite: real browser against the real app + database.
// The db is reseeded once in global-setup; specs run serially (single
// worker, alphabetical file order) since they share state.
export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.APP_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: process.env.APP_URL || "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 90_000,
  },
  reporter: [["list"]],
});
