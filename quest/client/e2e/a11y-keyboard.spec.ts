// Keyboard-only paths (255): on every screen Tab reaches every control with
// the theme's focus ring and comes back round with no trap, Shift+Tab the
// same set; the top bar, the workspace, the Levels tabs and each panel in
// the order the spec gives; Escape closes a panel back to its opener; and a
// dropped connection leaves focus where it was.
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { PANELS, SCREENS, title } from "./a11y-screens.ts";
import { cardEntries } from "./snapshots.ts";
import {
  THEMES,
  activeStop,
  expectVisibleFocus,
  focusTrail,
  reachable,
  settle,
  useTheme,
} from "./a11y.ts";
import { actionsOf, bar } from "./play.ts";
import {
  askBeat,
  offersBoth,
  snapshotOf,
  stepDown,
  stepDownGuided,
  typeBeat,
  watching,
  overviewAt,
  fullCourse,
} from "./snapshots.ts";

test.use({ manualStream: true, viewport: { width: 1280, height: 800 } });

const names = (stops: { name: string }[]) => stops.map((s) => s.name);

/** Walks Tab and Shift+Tab round the page, or `scope`, and checks both. */
async function walk(page: Page, scope?: string) {
  const count = await reachable(page, scope);
  const forward = await focusTrail(page, count);
  // A closed walk inside the page stops once each; one outside a panel stops
  // also at the browser's own chrome, which shows here as the body.
  expect(forward.length, names(forward).join(" | ")).toBe(count);
  const back = await focusTrail(page, count, "Shift+Tab");
  expect(new Set(back.map((s) => s.key))).toEqual(
    new Set(forward.map((s) => s.key)),
  );
  return forward;
}

for (const scheme of THEMES)
  test.describe(`${scheme} theme`, () => {
    for (const row of SCREENS)
      test(`${row.name}: Tab reaches every control with a ring, and no trap`, async ({
        page,
        context,
      }) => {
        await useTheme(page, scheme);
        await row.open(page, context);
        await settle(page);
        await walk(page);
      });

    for (const row of PANELS)
      test(`${row.name}: Enter opens it on Close, Tab stays inside, Escape returns to ${row.opener ?? ""}`, async ({
        page,
        context,
      }) => {
        await useTheme(page, scheme);
        await row.open(page, context);
        await settle(page);
        const dialog = page.getByRole("dialog").last();
        await expect(
          dialog.getByRole("button", { name: "Close" }).first(),
        ).toBeFocused();
        await walk(page, "[role=dialog]:last-of-type");
        // Every stop the walk made was inside the dialog.
        const inside = await page.evaluate(
          () =>
            document.activeElement?.closest("[role=dialog]") !== null &&
            document.activeElement !== null,
        );
        expect(inside).toBe(true);
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("button", { name: row.opener ?? "", exact: true }),
        ).toBeFocused();
      });
  });

/** b-1's workspace, with skills on the Learner's card so it shows. */
async function workspace(page: Page) {
  await page.goto("/#/lesson/b-1/step");
  const data = snapshotOf(watching, { welcomed: true, course: fullCourse });
  await connected(page, {
    ...data,
    learner: { ...data.learner, card: cardEntries },
  });
}

test("each panel opens from its opener with Enter", async ({ page }) => {
  await workspace(page);
  await expect(title(page)).toBeVisible();
  for (const name of ["Steps", "Your card", "Settings"]) {
    await page.getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
  }
});

test("a route change moves focus to the new screen's title", async ({
  page,
}) => {
  await page.goto("/#/lesson/b-1/step");
  await connected(page, snapshotOf(watching));
  await expect(title(page)).toBeVisible();
  await page.getByRole("link", { name: "Progress" }).focus();
  await page.keyboard.press("Enter");
  await expect(title(page)).toHaveText("Progress");
  await expect(title(page)).toBeFocused();
});

test("the top bar's order: brand, crumbs, Steps, Journey, Progress, Your card, Settings", async ({
  page,
}) => {
  await workspace(page);
  await expect(title(page)).toBeVisible();
  await settle(page);
  const stops = await walk(page);
  const top = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-top] a, [data-top] button")].length,
  );
  expect(names(stops.slice(0, top))).toEqual([
    expect.stringMatching(/Claude Code Quest/),
    "Beginner",
    "Lesson 1",
    expect.stringMatching(/Steps/),
    expect.stringMatching(/^Journey$/),
    expect.stringMatching(/^Progress$/),
    expect.stringMatching(/Your card/),
    expect.stringMatching(/Settings/),
  ]);
});

for (const motion of [false, true])
  test(`the workspace: the step card, then the action bar's Back, Skip and primary, and Enter sends it${motion ? ", with full motion" : ""}`, async ({
    page,
  }) => {
    await useTheme(page, "light", motion);
    const posts = actionsOf(page);
    await page.goto("/#/lesson/b-1/step");
    await connected(page, snapshotOf(offersBoth));
    await expect(page.locator("[data-step-card]")).toBeVisible();
    await settle(page);
    const stops = await walk(page);
    const where = await page.evaluate(() => {
      const card = document.querySelector("[data-step-card]");
      const actions = document.querySelector("[data-action-bar]");
      return { card: card !== null, actions: actions !== null };
    });
    expect(where).toEqual({ card: true, actions: true });
    // The bar's three buttons are the last stops in main, in their order.
    const inBar = await bar(page).getByRole("button").allInnerTexts();
    const order = names(stops).filter((name) =>
      inBar.some((text) => text.replace(/\s+/g, " ").trim() === name),
    );
    expect(order.length).toBe(inBar.length);
    expect(order[0]).toMatch(/Back/);
    expect(order[1]).toMatch(/Skip/);
    // The card's controls come before the bar's.
    const firstBar = names(stops).indexOf(order[0] ?? "");
    const card = await page
      .locator("[data-step-card] button, [data-step-card] a")
      .count();
    expect(firstBar).toBeGreaterThanOrEqual(card);
    const primary = bar(page).getByRole("button").last();
    await primary.focus();
    await expectVisibleFocus(page);
    const before = posts.length;
    await page.keyboard.press("Enter");
    await expect.poll(() => posts.length).toBeGreaterThan(before);
  });

test("the Levels are one Tab stop; the arrows move the selection and focus, and Tab goes on into the Lessons", async ({
  page,
}) => {
  await page.goto("/#/journey");
  await connected(
    page,
    snapshotOf(overviewAt("b-4"), { welcomed: true, course: fullCourse }),
  );
  await expect(title(page)).toBeVisible();
  const tabs = page.getByRole("tab");
  const selected = page.getByRole("tab", { selected: true });
  await selected.focus();
  const first = await selected.innerText();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { selected: true })).toBeFocused();
  expect(await page.getByRole("tab", { selected: true }).innerText()).not.toBe(
    first,
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { selected: true })).toBeFocused();
  expect(await page.getByRole("tab", { selected: true }).innerText()).toBe(
    first,
  );
  // Only the selected tab takes Tab.
  expect(
    await tabs.evaluateAll(
      (all) => all.filter((t) => (t as HTMLElement).tabIndex === 0).length,
    ),
  ).toBe(1);
  // Past the Electives summaries, Tab lands on the selected Level's Lessons.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await activeStop(page);
    expect(stop?.role).not.toBe("tab");
    const inPanel = await page.evaluate(
      () => document.activeElement?.closest("[role=tabpanel]") !== null,
    );
    if (inPanel) return;
  }
  throw new Error("Tab never reached the Level's Lessons");
});

test("Start over: Keep my place takes focus, Escape goes back to the button, and Tab passes through", async ({
  page,
  context,
}) => {
  const row = SCREENS.find((r) => r.name === "Start over");
  if (!row) throw new Error("no Start over row");
  await row.open(page, context);
  const ask = page.getByRole("group", { name: "Start over" });
  await expect(
    ask.getByRole("button", { name: "Keep my place" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const outside = await page.evaluate(
    () => document.activeElement?.closest("[role=group]") === null,
  );
  expect(outside).toBe(true);
  await ask.getByRole("button", { name: "Keep my place" }).focus();
  await page.keyboard.press("Escape");
  await expect(ask).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start over" })).toBeFocused();
});

test("Step-down: focus on its heading, then each choice by Tab and Enter", async ({
  page,
}) => {
  const choices = [
    [stepDown, "Back"],
    [stepDown, "Go on on your own"],
    [stepDownGuided, "Go on with hints"],
    [stepDownGuided, "Keep every command shown"],
  ] as const;
  for (const [lesson, name] of choices) {
    const posts = actionsOf(page);
    await page.goto("/#/lesson/b-1/step");
    await connected(page, snapshotOf(lesson));
    const heading = page.getByRole("heading", {
      level: 1,
      name: "Less help from here",
    });
    await expect(heading).toBeVisible();
    await heading.focus();
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press("Tab");
      const stop = await activeStop(page);
      if (stop?.name === name) break;
    }
    await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
    await expectVisibleFocus(page);
    const before = posts.length;
    await page.keyboard.press("Enter");
    await expect.poll(() => posts.length).toBeGreaterThan(before);
    await page.goto("about:blank");
  }
});

test.describe("a dropped connection leaves focus where it was", () => {
  test("on an answer", async ({ page }) => {
    await page.goto("/#/lesson/b-1/step");
    await connected(page, snapshotOf(askBeat));
    const radio = page.getByRole("radio").first();
    await radio.focus();
    await page.evaluate(() => {
      window.__questStream.fail();
    });
    await expect(page.locator("[data-notice-region]")).toHaveText(
      /Reconnecting/,
      { timeout: 6000 },
    );
    await expect(radio).toBeFocused();
  });

  test("in the typed answer", async ({ page }) => {
    await page.goto("/#/lesson/b-1/step");
    await connected(page, snapshotOf(typeBeat));
    const input = page.getByRole("textbox");
    await input.focus();
    await page.evaluate(() => {
      window.__questStream.fail();
    });
    await expect(page.locator("[data-notice-region]")).toHaveText(
      /Reconnecting/,
      { timeout: 6000 },
    );
    await expect(input).toBeFocused();
  });
});
