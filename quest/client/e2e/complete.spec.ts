// Lesson, Level and course complete (249): each moment plays once, from its
// pending milestone, in exactly one page of the browser, and never again on
// a reload, a reconnect, a second page or a new server instance. The fake
// server remembers each milestone.shown (live.ts `shownMilestones`).
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./live.ts";
import {
  beginnerDone,
  complete,
  completeCapstone,
  completed,
  levelCompleted,
  noticeFirst,
  overviewAt,
  snapshotOf,
} from "./snapshots.ts";

const LEVEL = levelCompleted[1];
const capstoneWith = (milestones: typeof levelCompleted) =>
  snapshotOf(completeCapstone, { course: beginnerDone, milestones });

test.use({ shownMilestones: true });

/** Every milestone.shown the context's pages POST, oldest first. */
function shownPosts(context: BrowserContext): string[] {
  const shown: string[] = [];
  context.on("request", (request) => {
    if (request.method() !== "POST" || !request.url().endsWith("/api/actions"))
      return;
    const { action } = request.postDataJSON() as {
      action: { type: string; id?: string };
    };
    if (action.type === "milestone.shown") shown.push(action.id ?? "");
  });
  return shown;
}

/**
 * Records, in each page, the id of every Reaction Pip starts (a milestone's
 * Reaction carries its event ID): summed across the context's pages for the
 * milestones' ids, it is how many Celebrations played.
 */
async function countCelebrations(context: BrowserContext) {
  await context.addInitScript(() => {
    const seen = new Set<string>();
    (window as unknown as { __reactions: () => string[] }).__reactions = () => [
      ...seen,
    ];
    new MutationObserver((records) => {
      for (const record of records) {
        const value = (record.target as Element).getAttribute(
          "data-pip-reaction",
        );
        if (value) seen.add(value);
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-pip-reaction"],
    });
  });
}

const MILESTONE_IDS = new Set(
  [...levelCompleted, ...completed].map((m) => m.id),
);

const celebrations = async (pages: Page[]) => {
  let sum = 0;
  for (const page of pages) {
    const ids = await page.evaluate(() =>
      (window as unknown as { __reactions: () => string[] }).__reactions(),
    );
    sum += ids.filter((id) => MILESTONE_IDS.has(id)).length;
  }
  return sum;
};

/** Long enough for a claim, its POST and a Reaction to have started. */
const settle = (page: Page) => page.waitForTimeout(1_000);

const levelTitle = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Beginner level complete" });

test.describe("the Level moment", () => {
  test.use({
    routedSnapshots: { level: capstoneWith([LEVEL] as typeof levelCompleted) },
  });

  test("(a) a reload shows it still, with no second claim", async ({
    page,
    context,
  }) => {
    const shown = shownPosts(context);
    await countCelebrations(context);
    await page.goto("/#/level/b/complete");
    await expect(levelTitle(page)).toBeVisible();
    await expect.poll(() => shown).toEqual([LEVEL?.id]);
    await expect.poll(() => celebrations([page])).toBe(1);
    await page.reload();
    await expect(levelTitle(page)).toBeVisible();
    await expect(
      page.getByRole("list", { name: "The Beginner level's badges" }),
    ).toBeVisible();
    await settle(page);
    expect(shown).toHaveLength(1);
    expect(await celebrations([page])).toBe(0);
  });

  test("(b) a dropped and reopened stream at the same revision replays nothing", async ({
    page,
    context,
  }) => {
    const shown = shownPosts(context);
    await page.goto("/#/level/b/complete");
    await expect.poll(() => shown).toHaveLength(1);
    await page.evaluate(() => {
      window.__questStream.fail();
    });
    await page.waitForFunction(() => window.__questStream.urls.length > 1);
    await settle(page);
    expect(shown).toHaveLength(1);
    await expect(levelTitle(page)).toBeVisible();
  });

  test("(c) of two pages, exactly one claims it", async ({ page, context }) => {
    const shown = shownPosts(context);
    await countCelebrations(context);
    const other = await context.newPage();
    await Promise.all([
      page.goto("/#/level/b/complete"),
      other.goto("/#/level/b/complete"),
    ]);
    await expect(levelTitle(page)).toBeVisible();
    await expect(levelTitle(other)).toBeVisible();
    await settle(page);
    expect(shown).toEqual([LEVEL?.id]);
    expect(await celebrations([page, other])).toBe(1);
  });

  test("(d) a new instance's frame after the shown plays nothing", async ({
    page,
    context,
  }) => {
    const shown = shownPosts(context);
    await countCelebrations(context);
    await page.goto("/#/level/b/complete");
    await expect.poll(() => shown).toHaveLength(1);
    const before = await celebrations([page]);
    // A restarted server: a new instance, its pending list already without the shown one.
    await page.evaluate(
      (frame) => {
        window.__questStream.snapshot(frame);
      },
      { ...capstoneWith([]), instance: "e2e-2", revision: 1 },
    );
    await settle(page);
    expect(shown).toHaveLength(1);
    expect(await celebrations([page])).toBe(before);
  });

  test("row 309: the next Level's button acts during the Celebration", async ({
    page,
  }) => {
    await page.goto("/#/level/b/complete");
    const start = page.getByRole("button", {
      name: "Start the Intermediate level",
    });
    await expect(start).toBeVisible();
    const sent = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/actions") &&
        (request.postDataJSON() as { action: { type: string } }).action.type ===
          "lesson.open",
    );
    await start.click();
    expect((await sent).postDataJSON()).toMatchObject({
      action: { type: "lesson.open", lesson: "i-1" },
    });
  });
});

for (const motion of ["no-preference", "reduce"] as const) {
  test.describe(`reduced motion: ${motion}`, () => {
    test.describe("(e) reached with no tab open", () => {
      test.use({
        routedSnapshots: {
          journey: snapshotOf(overviewAt("i-1"), {
            welcomed: true,
            course: beginnerDone,
            milestones: [LEVEL] as typeof levelCompleted,
          }),
          level: capstoneWith([LEVEL] as typeof levelCompleted),
        },
      });

      test("the journey links the moment, which plays once", async ({
        page,
        context,
      }) => {
        await page.emulateMedia({ reducedMotion: motion });
        const shown = shownPosts(context);
        await countCelebrations(context);
        await page.goto("/#/journey");
        const link = page.getByRole("link", {
          name: "See the Beginner level complete",
        });
        await expect(link).toBeVisible();
        expect(shown).toEqual([]);
        await link.click();
        await expect(levelTitle(page)).toBeVisible();
        await expect.poll(() => shown).toEqual([LEVEL?.id]);
        await expect.poll(() => celebrations([page])).toBe(1);
        await expectStill(page, motion);
        await page.reload();
        await expect(levelTitle(page)).toBeVisible();
        await settle(page);
        expect(shown).toHaveLength(1);
        expect(await celebrations([page])).toBe(0);
      });
    });

    test.describe("(f) the capstone and its Level", () => {
      test.use({
        routedSnapshots: { complete: capstoneWith(levelCompleted) },
      });

      test("the reveal, then the hand-over, then the Level moment", async ({
        page,
        context,
      }) => {
        await page.emulateMedia({ reducedMotion: motion });
        const shown = shownPosts(context);
        await page.goto("/#/lesson/b-capstone/complete");
        await expect(page.getByText("New badge: Beginner")).toBeAttached();
        await expect.poll(() => shown).toEqual([levelCompleted[0]?.id]);
        await expect(page.getByRole("button", { name: /^Next/ })).toHaveCount(
          0,
        );
        await page
          .getByRole("link", { name: "See the Beginner level complete" })
          .click();
        await expect(levelTitle(page)).toBeVisible();
        await expect
          .poll(() => shown)
          .toEqual([levelCompleted[0]?.id, levelCompleted[1]?.id]);
        await expectStill(page, motion);
      });
    });
  });
}

/**
 * The Level moment's text and Badges are there; under reduced motion no
 * running animation moves anything (a rise of 0px is a fade).
 */
async function expectStill(page: Page, motion: "no-preference" | "reduce") {
  await expect(
    page.getByText("Every lesson of the level is done, its capstone too."),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "The Beginner level's badges" })
      .getByRole("img"),
  ).toHaveCount(6);
  if (motion !== "reduce") return;
  const moving = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .filter((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          return (effect?.getKeyframes() ?? []).some(
            (frame) =>
              typeof frame.transform === "string" &&
              !/^(none|translate[XY]?\(0px(, 0px)?\))$/.test(frame.transform),
          );
        }).length,
  );
  expect(moving).toBe(0);
}

test.describe("a notice first", () => {
  test.use({
    routedSnapshots: {
      complete: snapshotOf(complete, { milestones: noticeFirst }),
    },
  });

  // The celebration claims only its own milestone; the notice is claimed
  // by the save notices strip (252), so both ids are shown once each.
  test("still celebrates the Lesson, and leaves the notice to its strip", async ({
    page,
    context,
  }) => {
    const shown = shownPosts(context);
    await page.goto("/#/lesson/b-1/complete");
    await expect(page.getByText("New badge: Explorer")).toBeAttached();
    await expect
      .poll(() => [...shown].sort())
      .toEqual(["e2e.30", completed[0]?.id].sort());
  });
});
