// The Pip Playground's layout on the dev server: nothing jumps as you use it,
// every Pip keeps its own room at every width, on a phone the Stage stays in
// view while the controls scroll, and the private board is optional.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEV } from "../playwright.config.ts";

test.use({ baseURL: DEV });

const BOARD = "**/@playground/board.png";
// Any PNG stands in for the private board, which CI never has.
const STAND_IN = readFileSync(
  join(import.meta.dirname, "../pip/posters/idle-hero-front.png"),
);

async function open(page: Page, board: "present" | "missing" = "present") {
  await page.route(BOARD, (route) =>
    board === "present"
      ? route.fulfill({ contentType: "image/png", body: STAND_IN })
      : route.fulfill({ status: 404 }),
  );
  await page.goto("/#/playground");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pip Playground" }),
  ).toBeVisible({ timeout: 30_000 });
}

const card = (page: Page, title: string) =>
  page.locator("section", {
    has: page.getByRole("heading", { level: 2, name: title, exact: true }),
  });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (found === null) throw new Error(`No box for ${String(locator)}`);
  return found;
}

type Box = Awaited<ReturnType<typeof box>>;

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5;

const pageScrollsSideways = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );

test.describe("at 1440 px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("pressing a Reaction moves none of the controls below it", async ({
    page,
  }) => {
    await open(page);
    const intensity = page.getByRole("slider", { name: "Intensity" });
    const before = (await box(intensity)).y;
    for (const name of ["Greeting", "Celebration"]) {
      await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      await expect(
        page.getByRole("button", { name: new RegExp(`^${name}`) }),
      ).toContainText("last at 1");
      expect((await box(intensity)).y, name).toBe(before);
    }
  });

  test("the Stage's figures line up, and changing Size moves nothing below", async ({
    page,
  }) => {
    await open(page);
    const figures = card(page, "Stage").locator("figure");
    await expect(figures).toHaveCount(4);
    const model = card(page, "Model");
    let modelTop: number | undefined;
    for (const size of ["Hero", "Beside", "Icon"]) {
      await page.getByRole("radio", { name: size }).check({ force: true });
      const [live, fallback] = [
        await box(figures.nth(0)),
        await box(figures.nth(1)),
      ];
      expect(live.height, size).toBe(fallback.height);
      const captions = await figures
        .locator("figcaption")
        .evaluateAll((all) => all.map((c) => c.getBoundingClientRect().top));
      expect(new Set(captions).size, `${size}: ${captions.join(", ")}`).toBe(1);
      const top = (await box(model)).y;
      modelTop ??= top;
      expect(top, size).toBe(modelTop);
    }
  });
});

test.describe("at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the Sizes card shows each Pip whole, apart, with its caption under it", async ({
    page,
  }) => {
    await open(page);
    const sizes = card(page, "Sizes");
    const frame = await box(sizes);
    const hero = await box(sizes.locator('[data-pip="hero"]'));
    const beside = await box(sizes.locator('[data-pip="beside"]'));
    expect(overlap(hero, beside)).toBe(false);
    for (const pip of [hero, beside]) expect(inside(pip, frame)).toBe(true);
    for (const [name, pip] of [
      ["Hero", hero],
      ["Beside", beside],
    ] as const) {
      const caption = await box(sizes.locator("figcaption", { hasText: name }));
      expect(
        Math.abs(caption.x + caption.width / 2 - (pip.x + pip.width / 2)),
        name,
      ).toBeLessThanOrEqual(1);
    }
  });

  for (const source of ["The model", "The director"]) {
    test(`with ${source.toLowerCase()}, the Stage's Pips sit apart and the page never scrolls sideways`, async ({
      page,
    }) => {
      await open(page);
      await page.getByRole("radio", { name: source }).check({ force: true });
      const stage = card(page, "Stage");
      const frame = await box(stage);
      const live = await box(stage.locator('[data-playground-stage="live"]'));
      const fallback = await box(
        stage.locator("figure").nth(1).locator("[data-pip]"),
      );
      expect(overlap(live, fallback)).toBe(false);
      // The figures' row stays inside the card, scrolling sideways within it.
      const row = await box(stage.locator("figure").first().locator(".."));
      expect(inside(row, frame)).toBe(true);
      expect(await pageScrollsSideways(page)).toBe(false);
    });
  }

  test("the Stage comes first and stays in view while the controls scroll", async ({
    page,
  }) => {
    await open(page);
    const stage = card(page, "Stage");
    const controls = page.getByRole("complementary", { name: "Controls" });
    expect((await box(stage)).y).toBeLessThan((await box(controls)).y);
    // The last controls: the Display section's Size and switches.
    for (const control of [
      page.getByRole("slider", { name: "Intensity" }),
      page.getByRole("radio", { name: "Beside" }),
      page.getByRole("switch", { name: /Rive available/ }),
    ]) {
      await control.scrollIntoViewIfNeeded();
      const live = await box(stage.locator('[data-playground-stage="live"]'));
      const target = await box(control);
      expect(live.y).toBeGreaterThanOrEqual(0);
      expect(live.y + live.height).toBeLessThanOrEqual(target.y);
    }
  });
});

test("the range readouts are no live region", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("slider")).toHaveCount(3);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("the board's crops show where the board is on this machine", async ({
  page,
}) => {
  await open(page, "present");
  const board = card(page, "The approved board");
  await expect(board.getByRole("img", { name: /^Pip: / })).toHaveCount(19);
  await expect(page.getByText("Board not available")).toHaveCount(0);
});

test("where the board is not, the Playground says so calmly", async ({
  page,
}) => {
  await open(page, "missing");
  const board = card(page, "The approved board");
  await expect(board.getByText("Board not available")).toBeVisible();
  await expect(page.getByRole("img", { name: /^Pip: / })).toHaveCount(0);
  await expect(
    card(page, "Stage").getByText("Board not available"),
  ).toBeVisible();
});
