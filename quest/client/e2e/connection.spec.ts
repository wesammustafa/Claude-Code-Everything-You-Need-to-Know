// The connection's states on screen ("Connection states"): Reconnecting after
// 3 seconds of a dropped stream, stopped with `npm run learn` once a health
// request fails too after 15, and a reconnect that clears the notice quietly.
// The stream is the page's fake (live.ts), driven frame by frame.
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { watch } from "./watch.ts";

test.use({ manualStream: true });

const notice = (page: Page) => page.locator("[data-notice-region]");

test("a dropped stream shows Reconnecting after 3 seconds, and a reconnect clears it quietly", async ({
  page,
}) => {
  const seen = watch(page);
  await page.goto("/#/journey");
  await connected(page);
  const dropped = Date.now();
  await page.evaluate(() => {
    window.__questStream.fail();
  });
  await expect(notice(page)).toHaveText(/Reconnecting to Claude Code Quest/, {
    timeout: 6000,
  });
  expect(Date.now() - dropped).toBeGreaterThanOrEqual(2900);
  await expect(page.locator("[data-notice]")).toHaveCount(1);

  await connected(page);
  await expect(notice(page)).toBeEmpty();
  expect(seen.problems).toEqual([]);
});

test("after 15 seconds with the health request failing too, it says Claude Code Quest stopped, with npm run learn", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route("**/api/health", (route) => route.abort());
  await page.goto("/#/journey");
  await connected(page);
  await page.evaluate(() => {
    window.__questStream.down(true);
    window.__questStream.fail();
  });
  await expect(notice(page)).toHaveText(/Reconnecting/, { timeout: 6000 });
  await expect(notice(page)).toHaveText(
    /Claude Code Quest stopped\. Start it again in your terminal:/,
    { timeout: 20_000 },
  );
  await expect(notice(page)).toContainText("npm run learn");
  await expect(
    notice(page).getByRole("button", { name: /Copy/ }),
  ).toBeVisible();

  // The server is back: the next stream answers, and the notice goes.
  await page.evaluate(() => {
    window.__questStream.down(false);
  });
  await expect
    .poll(() => page.evaluate(() => window.__questStream.open), {
      timeout: 10_000,
    })
    .toBe(true);
  await connected(page);
  await expect(notice(page)).toBeEmpty();
});
