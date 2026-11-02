import { defineConfig, devices } from "@playwright/test";

const PREVIEW = "http://127.0.0.1:4319";
export const PIP_CONTRACT = "http://127.0.0.1:4320";
/** The client's dev server, for the Pip Playground, which only it serves. */
export const DEV = "http://127.0.0.1:4321";

/** Every host name but 127.0.0.1 fails to resolve in the test browser. */
export const ONLY_LOOPBACK =
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1";

const COLD_START = "cold-start.spec.ts";
const CHROMIUM = {
  ...devices["Desktop Chrome"],
  launchOptions: {
    args: [ONLY_LOOPBACK],
  },
};

// Playwright on the built client, Chromium only, served by `vite preview` on
// 127.0.0.1; the Pip Playground's specs alone run on the dev server. Every host name but 127.0.0.1 fails to resolve, so a request
// anywhere else could never succeed; the tests also record and refuse one.
export default defineConfig({
  testDir: "e2e",
  // Refuses a build (the app or the Pip contract page) from other sources than these.
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
      testIgnore: COLD_START,
      use: CHROMIUM,
    },
    {
      // The cold-start budget times the page, so it runs alone: after every
      // other spec, its own runs one at a time (the spec is serial).
      name: "cold-start",
      testMatch: COLD_START,
      dependencies: ["chromium"],
      use: CHROMIUM,
    },
  ],
  webServer: [
    {
      command: "npx vite preview",
      cwd: import.meta.dirname,
      url: PREVIEW,
      reuseExistingServer: false,
    },
    {
      // The Pip contract page, a test page built beside the app.
      command: "npx vite preview -c vite.pip-contract.config.ts",
      cwd: import.meta.dirname,
      url: PIP_CONTRACT,
      reuseExistingServer: false,
    },
    {
      // The dev server: the Pip Playground is development-only.
      command: "node dev.ts --port 4321",
      cwd: import.meta.dirname,
      url: DEV,
      reuseExistingServer: false,
    },
  ],
});
