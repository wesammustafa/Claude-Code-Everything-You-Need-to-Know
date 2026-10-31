// The live regions announce once per change (255): Pip's bubble says each
// new status once, from the same region, and nothing for a snapshot that
// changes nothing; the connection notice says Reconnecting once however
// long it retries, then stopped once, and clears quietly; and a Copy in the
// stopped notice is said once.
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { recordLiveRegions, said, settle, type Said } from "./a11y.ts";
import {
  hinted,
  snapshotOf,
  watchChecking,
  watchNotYet,
  watchWaiting,
} from "./snapshots.ts";

test.use({ manualStream: true });

test.beforeEach(async ({ context }) => {
  await recordLiveRegions(context);
});

let revision = 1;

async function show(page: Page, lesson: Parameters<typeof snapshotOf>[0]) {
  revision += 10;
  await connected(page, snapshotOf(lesson, { revision }));
}

/** The records after `from`, once the page has settled. */
async function since(page: Page, from: number): Promise<Said[]> {
  await settle(page);
  return (await said(page)).slice(from);
}

const bubbleRegion = (page: Page) =>
  page.locator("[data-says-bubble] [role=status]");

test("Pip's bubble: one region; a repeat says nothing, each new status once", async ({
  page,
}) => {
  await page.goto("/#/lesson/b-1/step");
  await show(page, watchWaiting);
  await expect(bubbleRegion(page)).toHaveCount(1);
  await settle(page);
  const start = (await said(page)).length;

  // The same snapshot three times: nothing new to say.
  for (let i = 0; i < 3; i += 1) await show(page, watchWaiting);
  expect(await since(page, start)).toEqual([]);

  // Each new status once, its words, from the same region throughout.
  let at = start;
  for (const lesson of [watchChecking, watchNotYet, hinted]) {
    const before = await bubbleRegion(page).innerText();
    await show(page, lesson);
    await expect(bubbleRegion(page)).not.toHaveText(before);
    const records = await since(page, at);
    expect(records, JSON.stringify(records)).toHaveLength(1);
    expect(records[0]?.text).toBe(
      (await bubbleRegion(page).textContent())?.replace(/\s+/g, " ").trim(),
    );
    at += records.length;
  }
  const regions = new Set((await said(page)).slice(start).map((r) => r.region));
  expect(regions.size).toBe(1);
});

const notice = (page: Page) => page.locator("[data-notice-region]");

/** The notice region's records, by its text. */
const noticeSaid = (records: Said[]) =>
  records.filter((r) => r.text === "" || /Reconnecting|stopped/.test(r.text));

test("the connection notice: Reconnecting once, stopped once, then clears quietly, from one region", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route("**/api/health", (route) => route.abort());
  await page.goto("/#/journey");
  await connected(page);
  const start = (await said(page)).length;
  await page.evaluate(() => {
    window.__questStream.down(true);
    window.__questStream.fail();
  });
  await expect(notice(page)).toHaveText(/Reconnecting/, { timeout: 6000 });
  // Two more retries go by with the words the same.
  const opened = () => page.evaluate(() => window.__questStream.urls.length);
  const seen = await opened();
  await expect
    .poll(opened, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(seen + 2);
  await expect(notice(page)).toHaveText(/Reconnecting/);
  await expect(notice(page)).toHaveText(
    /Claude Code Quest stopped\. Start it again in your terminal:/,
    { timeout: 20_000 },
  );
  await page.unroute("**/api/health");
  await page.evaluate(() => {
    window.__questStream.down(false);
  });
  await expect
    .poll(() => page.evaluate(() => window.__questStream.open), {
      timeout: 20_000,
    })
    .toBe(true);
  await connected(page);
  await expect(notice(page)).toBeEmpty();
  const records = noticeSaid(await since(page, start));
  expect(records.map((r) => r.text.slice(0, 40))).toEqual([
    expect.stringMatching(/^Reconnecting to Claude Code Quest/),
    expect.stringMatching(/^Claude Code Quest stopped/),
    "",
  ]);
  expect(new Set(records.map((r) => r.region)).size).toBe(1);
});

test("a Copy in the stopped notice is said once", async ({ page, context }) => {
  test.setTimeout(60_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/health", (route) => route.abort());
  await page.goto("/#/journey");
  await connected(page);
  await page.evaluate(() => {
    window.__questStream.down(true);
    window.__questStream.fail();
  });
  const copy = notice(page).getByRole("button", { name: /Copy/ });
  await expect(copy).toBeVisible({ timeout: 25_000 });
  await settle(page);
  const start = (await said(page)).length;
  await copy.click();
  await expect(notice(page)).toContainText("Copied");
  const records = await since(page, start);
  expect(
    records.filter((r) => r.text.includes("Copied")),
    JSON.stringify(records),
  ).toHaveLength(1);
});
