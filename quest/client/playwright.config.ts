import { defineConfig, devices } from "@playwright/test";

const PREVIEW = "http://127.0.0.1:4319";

// Playwright on the built client, Chromium only, served by `vite preview` on
// 127.0.0.1. Every host name but 127.0.0.1 fails to resolve, so a request
// anywhere else could never succeed; the tests also record and refuse one.
export default defineConfig({
  testDir: "e2e",
  // Refuses a dist/app built from other sources than these.
  globalSetup: "./e2e/fresh-build.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: PREVIEW,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
        },
      },
    },
  ],
  webServer: {
    command: "npx vite preview",
    cwd: import.meta.dirname,
    url: PREVIEW,
    reuseExistingServer: false,
  },
});
