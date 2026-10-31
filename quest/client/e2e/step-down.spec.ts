// The Step-down screen (248, AC2): a calm moment with a hero Pip, the two
// tiers and the choices; under reduced motion the moment stays, with no
// travel.
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { snapshotOf, stepDown, stepDownGuided } from "./snapshots.ts";

test.use({ manualStream: true });

const css = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

async function openAt(page: Page, lesson: typeof stepDown) {
  await page.goto("/#/lesson/b-1/step");
  await connected(page, snapshotOf(lesson));
  await expect(
    page.getByRole("heading", { level: 1, name: "Less help from here" }),
  ).toBeVisible();
}

test("under reduced motion the moment stays, with no travel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAt(page, stepDown);
  const tiers = page.locator("[data-pip-target=tiers]");
  await expect(tiers.locator("[data-tier=hinted]")).toBeVisible();
  await expect(tiers.locator("[data-tier=challenge]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go on on your own" }),
  ).toBeVisible();
  await expect(page.locator("main [data-pip=hero]")).toBeVisible();
  expect((await css(page, ":root", "--rise")).trim()).toBe("0px");
});

test("Guided to Hinted offers going on with hints or keeping every command", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openAt(page, stepDownGuided);
  const tiers = page.locator("[data-pip-target=tiers]");
  await expect(tiers.locator("[data-tier=guided]")).toBeVisible();
  await expect(tiers.locator("[data-tier=hinted]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go on with hints" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep every command shown" }),
  ).toBeVisible();
  await expect(page.locator("main [data-pip=hero]")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/level.?up/i);
});
