// Moves on the workspace, as a Learner makes them, shared by the specs that
// drive the built app in a Practice copy (practice-copy.ts): the b-1 slice,
// Work folders and the verify-kind matrix.
import { expect, type Page } from "@playwright/test";
import { lessonOrder } from "../../release/src/replay.mjs";
import { repoRoot, type PracticeCopy } from "./practice-copy.ts";

/** Key names: no workspace string may name one (246 D14). */
export const KEY_NAMES =
  /\b(press|key|keys|Enter|Esc(ape)?|Ctrl|Cmd|Tab|Space(bar)?|Return)\b/i;

export const heading = (page: Page) => page.getByRole("heading", { level: 1 });
export const bar = (page: Page) => page.locator("[data-action-bar]");

/** Every action the page POSTs, in order. */
export function actionsOf(
  page: Page,
): { type: string; [field: string]: unknown }[] {
  const sent: { type: string }[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST" || !request.url().endsWith("/api/actions"))
      return;
    const body = request.postDataJSON() as { action: { type: string } };
    sent.push(body.action);
  });
  return sent;
}

/** The course's Lessons before `id`, in course order (course/manifest.json). */
export function lessonsBefore(id: string): string[] {
  const order = lessonOrder(repoRoot);
  const at = order.indexOf(id);
  if (at < 0) throw new Error(`no lesson "${id}" in the course`);
  return order.slice(0, at);
}

/** A format-1 save with every Lesson before `id` complete. */
export function saveBefore(id: string, folders: Record<string, string> = {}) {
  return JSON.stringify({
    format: 1,
    welcomed: true,
    eased: [],
    missed: [],
    lessons: Object.fromEntries(
      lessonsBefore(id).map((l) => [l, { complete: true }]),
    ),
    folders,
  });
}

/**
 * A save like saveBefore's, with Lesson `id` open at `step`, on its beat
 * `beat` (from 0), so Continue on Welcome opens the workspace there.
 */
export function saveAt(
  id: string,
  step: string,
  beat: number,
  folders: Record<string, string> = {},
) {
  const save = JSON.parse(saveBefore(id, folders)) as {
    lessons: Record<string, unknown>;
  };
  save.lessons[id] = { step, beat };
  return JSON.stringify(save);
}

/**
 * To Lesson `id`'s overview: from Welcome to the course's next Lesson, or,
 * where that is another (a-5 with no new copy saved is not next), by its
 * route and Open this lesson.
 */
export async function openLesson(page: Page, copy: PracticeCopy, id?: string) {
  if (id === undefined) {
    await page.goto(copy.url);
    await page.getByRole("button", { name: "Start the first lesson" }).click();
  } else {
    await page.goto(`${copy.url}/#/lesson/${id}`);
    const open = page.getByRole("button", { name: "Open this lesson" });
    await expect(open.or(page.locator("[data-folder-question]"))).toBeVisible();
    if (await open.isVisible()) await open.click();
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/**
 * One move on the workspace, as a Learner makes it: go on from a done beat,
 * take a Step-down, answer a question (trying each answer in turn), run the
 * Check, or say a self beat is done. Resolves once the page shows the
 * engine's answer.
 */
export async function move(page: Page) {
  const before = await page.locator("main").innerText();
  const next = bar(page).getByRole("button", { name: "Next step" });
  const check = bar(page).getByRole("button", { name: "Check again" });
  // The answers not tried yet: a wrong one stays marked, the next is tried.
  const untried = page.locator(
    "main fieldset:not([disabled]) label[data-state=idle]",
  );
  if ((await heading(page).innerText()) === "Less help from here") {
    await page.getByRole("button", { name: /^Go on/ }).click();
  } else if (await next.isVisible()) {
    await next.click();
  } else if ((await untried.count()) > 0) {
    // Picking only selects (247): the button under the answers sends it.
    await untried.first().click();
    await page
      .locator("main")
      .getByRole("button", { name: /^(Check my answer|That's my guess)$/ })
      .first()
      .click();
  } else if (await check.isVisible()) {
    await check.click();
    // A passed Check may lead straight to a Step-down.
    const stepDown = page.getByRole("heading", { name: "Less help from here" });
    await expect(
      next.or(page.locator("[data-state=not-yet]")).or(stepDown),
    ).toBeVisible({
      timeout: 30_000,
    });
    return;
  } else {
    await bar(page).getByRole("button").last().click();
  }
  await expect
    .poll(() => page.locator("main").innerText(), { timeout: 15_000 })
    .not.toBe(before);
}

/** Moves on until the step's heading is `title`. */
export async function playTo(page: Page, title: string) {
  for (let moves = 0; moves < 60; moves += 1) {
    if ((await heading(page).innerText()) === title) return;
    await move(page);
  }
  throw new Error(`Never reached ${title}`);
}
