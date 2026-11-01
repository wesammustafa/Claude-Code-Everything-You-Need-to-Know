// The final document's scenarios that no earlier ticket holds (254), on the
// built app in a Practice copy: the next Lesson, a Terminal app save that
// resumes in place, a b-1 play with only the keyboard, a b-1 play under
// reduced motion, and every screen and panel of b-1 with a restart and
// resume.
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { bar, heading, move, playTo, saveAt, saveBefore } from "./play.ts";
import { practiceCopy, repoRoot, type PracticeCopy } from "./practice-copy.ts";
import {
  courseLessons,
  expectStill,
  recordFrames,
  stepTitle,
  takeOutFresh,
  walkLesson,
} from "./walk.ts";

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(240_000);

/** Runs `body` on a copy replayed through `through`, saved with `save`. */
async function withCopy(
  {
    through,
    save,
  }: { through?: string; save?: (copy: PracticeCopy) => string },
  body: (copy: PracticeCopy) => Promise<void>,
) {
  const copy = practiceCopy(through === undefined ? {} : { through });
  try {
    if (save !== undefined) copy.write(".practice/learn.json", save(copy));
    await copy.start();
    await body(copy);
  } finally {
    await copy.dispose();
  }
}

/** The last step of Lesson `id` and its last beat, as a save keeps them. */
function lastBeat(id: string): [string, number] {
  const lesson = courseLessons().find((l) => l.id === id);
  const step = lesson?.content.steps.at(-1);
  if (step === undefined) throw new Error(`${id} has no steps`);
  return [step.id, step.beats.length - 1];
}

test("next Lesson: b-1's Lesson complete offers b-2, and it opens b-2's overview", async ({
  page,
}) => {
  await withCopy(
    { through: "b-1", save: () => saveAt("b-1", ...lastBeat("b-1")) },
    async (copy) => {
      await page.goto(copy.url);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(heading(page)).toHaveText(
        stepTitle("b-1", lastBeat("b-1")[0]),
      );
      for (let moves = 0; moves < 5; moves += 1) {
        if (/\/complete$/.test(page.url())) break;
        await move(page);
      }
      await expect(page).toHaveURL(/#\/lesson\/b-1\/complete$/);
      const next = page.getByRole("button", { name: /^Next: / });
      await expect(next).toBeVisible();
      await next.click();
      await expect(page).toHaveURL(/#\/lesson\/b-2$/);
      await expect(
        page.getByRole("button", { name: "Start", exact: true }),
      ).toBeVisible();
    },
  );
});

const FIXTURES = join(repoRoot, "quest/host/test/fixtures/terminal-saves");
/** A Terminal app save, with its Work folder placeholder set as terminal-saves.test.mjs sets it. */
const terminalSave = (name: string, work: string) =>
  readFileSync(join(FIXTURES, `${name}.json`), "utf8").replaceAll(
    "@WORK@",
    work.replaceAll("\\", "\\\\"),
  );
const ORACLE = JSON.parse(
  readFileSync(join(FIXTURES, "oracle.json"), "utf8"),
) as Record<string, { lesson: string; step: string | null; beat: number }>;

test("progress migration: a Terminal app save resumes in place", async ({
  page,
}) => {
  const want = ORACLE["mid-lesson"];
  if (want?.step == null) throw new Error("the oracle has no mid-lesson step");
  await withCopy(
    {
      through: "b-1",
      save: (copy) => terminalSave("mid-lesson", join(copy.home, "work")),
    },
    async (copy) => {
      await page.goto(copy.url);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(heading(page)).toHaveText(
        stepTitle(want.lesson, want.step ?? ""),
      );
      await move(page);
      expect((copy.saved() as { format: number }).format).toBe(1);
    },
  );
  // completed.json: the done Lessons show done in the Journey.
  await withCopy(
    { save: (copy) => terminalSave("completed", join(copy.home, "work")) },
    async (copy) => {
      await page.goto(`${copy.url}/#/journey`);
      await expect(
        page.getByRole("tab", { name: "Beginner Complete 6 of 6" }),
      ).toBeVisible();
    },
  );
  // keep-guided.json loads, at its oracle's step.
  const kept = ORACLE["keep-guided"];
  await withCopy(
    {
      through: "b-1",
      save: (copy) => terminalSave("keep-guided", join(copy.home, "work")),
    },
    async (copy) => {
      await page.goto(copy.url);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(heading(page)).toHaveText(
        stepTitle(kept?.lesson ?? "", kept?.step ?? ""),
      );
    },
  );
});

/** Tabs forward until the focused control's name matches `name`. */
async function tabTo(page: Page, name: RegExp) {
  for (let presses = 0; presses < 60; presses += 1) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const at = document.activeElement as HTMLElement | null;
      return (at?.getAttribute("aria-label") ?? at?.innerText ?? "").trim();
    });
    if (name.test(label)) return;
  }
  throw new Error(`Tab never reached ${String(name)}`);
}

/** Tabs forward to the action bar's last control. */
async function tabToBar(page: Page) {
  for (let presses = 0; presses < 80; presses += 1) {
    await page.keyboard.press("Tab");
    const there = await page.evaluate(() => {
      const at = document.activeElement;
      const buttons = document.querySelectorAll("[data-action-bar] button");
      return at !== null && at === buttons[buttons.length - 1];
    });
    if (there) return;
  }
  throw new Error("Tab never reached the action bar");
}

/** The focused control shows a focus ring and sits clear of the action bar. */
async function focusShows(page: Page) {
  const ring = await page.evaluate(() => {
    const at = document.activeElement as HTMLElement;
    const style = getComputedStyle(at);
    const box = at.getBoundingClientRect();
    return {
      outline:
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
      inBar: at.closest("[data-action-bar]") !== null,
      bottom: box.bottom,
    };
  });
  expect(ring.outline).toBe(true);
  if (!ring.inBar && (await bar(page).count()) > 0) {
    const over = await bar(page).boundingBox();
    if (over !== null) expect(ring.bottom).toBeLessThanOrEqual(over.y + 1);
  }
}

test("keyboard navigation: b-1 from Welcome to a passed Check with only the keyboard", async ({
  page,
}) => {
  await withCopy({}, async (copy) => {
    await page.goto(copy.url);
    await expect(
      page.getByRole("button", { name: "Start the first lesson" }),
    ).toBeVisible();
    await tabTo(page, /^Start the first lesson$/);
    await focusShows(page);
    await page.keyboard.press("Enter");
    await expect(heading(page)).toHaveText("Install, sign in and look around");
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
    await tabTo(page, /^Start$/);
    await focusShows(page);
    await page.keyboard.press("Space");
    // The steps list opens, and Escape closes it.
    await tabTo(page, /^Steps$/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // On through the first steps by the bar alone, to the first passed Check.
    const next = bar(page).getByRole("button", { name: "Next step" });
    for (let moves = 0; moves < 6; moves += 1) {
      if (await next.isVisible()) break;
      // A control is in the Tab order once it is enabled (not mid-Check).
      const last = bar(page).getByRole("button").last();
      await expect(last).toBeEnabled({ timeout: 30_000 });
      if (await next.isVisible()) break;
      await tabToBar(page);
      await focusShows(page);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }
    await expect(next).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("main [data-state=ok]").first()).toBeVisible();
  });
});

test("reduced motion: a whole b-1 play holds Pip still and moves no screen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await withCopy({ save: () => saveBefore("b-1") }, async (copy) => {
    copy.apply("b-1");
    const taken = takeOutFresh("b-1", join(copy.dir, "project"));
    const frames = await recordFrames(page);
    await page.goto(`${copy.url}/#/lesson/b-1`);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await walkLesson(page, copy, "b-1", frames, {
      taken,
      onScreen: (at) => expectStill(at),
    });
    await expectStill(page);
  });
});

test("every screen and panel of b-1, then a restart that resumes in place", async ({
  page,
}) => {
  await withCopy({}, async (copy) => {
    await page.goto(copy.url);
    await page.getByRole("button", { name: "Start the first lesson" }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await playTo(page, stepTitle("b-1", "W3"));
    // The page panel, from the card.
    await page.getByRole("button", { name: "Read the full lesson" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    // Settings.
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await page.keyboard.press("Escape");
    // Journey and Progress, then back by Welcome's Continue.
    await page.getByRole("link", { name: "Journey" }).first().click();
    await expect(page).toHaveURL(/#\/journey$/);
    await page.goto(`${copy.url}/#/progress`);
    await expect(heading(page)).toHaveText("Progress");
    await copy.restart();
    await page.goto(copy.url);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(heading(page)).toHaveText(stepTitle("b-1", "W3"));
  });
});

/** Plays b-1 a few moves with nothing saved: the notice stays, the steps go on. */
async function playUnsaved(page: Page, copy: PracticeCopy) {
  await page.goto(copy.url);
  const notice = page.locator("[data-save-notice='not-saving']");
  await expect(notice).toHaveText(
    "Progress is not being saved. If your practice copy has no .practice folder, run mkdir .practice there.",
  );
  await page.getByRole("button", { name: "Start the first lesson" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(bar(page)).toBeVisible();
  const first = await heading(page).innerText();
  for (let moves = 0; moves < 8; moves += 1) {
    if ((await heading(page).innerText()) !== first) break;
    await move(page);
  }
  await expect(heading(page)).not.toHaveText(first);
  await expect(notice).toBeVisible();
}

test("the save-failed notice shows in the shell, and the step stays usable", async ({
  page,
}) => {
  const copy = practiceCopy();
  try {
    // A copy whose root can't take a .practice folder: nothing is saved.
    chmodSync(copy.dir, 0o555);
    await copy.start();
    await playUnsaved(page, copy);
    expect(existsSync(join(copy.dir, ".practice"))).toBe(false);
  } finally {
    chmodSync(copy.dir, 0o755);
    await copy.dispose();
  }
});

test("the save-failed notice shows with a file where the .practice folder should be", async ({
  page,
}) => {
  const copy = practiceCopy();
  try {
    copy.write(".practice", "not a folder\n");
    await copy.start();
    await playUnsaved(page, copy);
  } finally {
    await copy.dispose();
  }
});
