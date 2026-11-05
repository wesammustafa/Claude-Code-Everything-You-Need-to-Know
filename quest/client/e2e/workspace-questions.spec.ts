// The Lesson workspace's questions, warm-ups and hints (247), on routed
// snapshots: a guess, a wrong then right answer (AC2), the answer shown, a
// typed answer, a choice that shows later beats, a warm-up, the waiting
// question, and every option and hint by keyboard alone (AC3).
import type { Page } from "@playwright/test";
import { connected, expect, sendEvents, test } from "./live.ts";
import { KEY_NAMES, actionsOf, bar } from "./play.ts";
import {
  askBeat,
  askRevealed,
  askRight,
  askWrong,
  confirmExact,
  exactTaken,
  hinted,
  predictBeat,
  predictDone,
  snapshotOf,
  typeBeat,
  typeWrong,
  waitQuestionEnded,
  waitQuestionOpen,
  warmupAsk,
  watching,
  whenOption,
} from "./snapshots.ts";

test.use({ manualStream: true });

let revision = 1;

async function openAt(page: Page, lesson: Parameters<typeof snapshotOf>[0]) {
  await page.goto(`/#/lesson/${lesson.id}/step`);
  await show(page, lesson);
  await expect(page.locator("[data-step-card]")).toBeVisible();
}

/** The next snapshot, a revision on. */
async function show(page: Page, lesson: Parameters<typeof snapshotOf>[0]) {
  // Ten on: the fake server answers hint.next a revision higher.
  revision += 10;
  await connected(page, snapshotOf(lesson, { revision }));
}

const pip = (page: Page) => page.locator("main [data-pip]").first();
const bubble = (page: Page) => page.locator("[data-says-words]");
const card = (page: Page) => page.locator("[data-step-card]");

async function event(page: Page, id: string, type: string) {
  await sendEvents(page, [{ id, type, revision, serverTime: Date.now() }]);
}

async function namesNoKey(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(KEY_NAMES);
}

test("a guess is sent by its button, drawn with no judgement, then Next step", async ({
  page,
}) => {
  const sent = actionsOf(page);
  await openAt(page, predictBeat);
  await expect(bubble(page)).toHaveText("Make your guess.");
  await card(page).getByText("Nothing at all").click();
  expect(sent).toEqual([]);
  await card(page).getByRole("button", { name: "That's my guess" }).click();
  await expect.poll(() => sent).toEqual([{ type: "answer.pick", option: 1 }]);
  await show(page, predictDone);
  // A guess made: what happens comes next, not "That step is done" (348).
  await expect(bubble(page)).toHaveText("Here's what happens.");
  await expect(card(page).locator("[data-state=chosen]")).toHaveText(
    /Nothing at all/,
  );
  await expect(
    card(page).locator("[data-state=right], [data-state=notYet]"),
  ).toHaveCount(0);
  await expect(
    bar(page).getByRole("button", { name: "Next step" }),
  ).toBeVisible();
  await namesNoKey(page);
});

test("a wrong answer plays Retry and keeps the step; a right one plays Success", async ({
  page,
}) => {
  await openAt(page, askBeat);
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await show(page, askWrong);
  await event(page, "q.1", "answer.wrong");
  await expect(pip(page)).toHaveAttribute("data-pip-reaction", "q.1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(bubble(page)).toHaveText("Not yet. Try another answer.");
  await expect(card(page).locator("[data-state=notYet]")).toContainText(
    "Every file in the folder",
  );
  await expect(card(page).locator("[data-because]")).toHaveText(
    "It reads only the files a task needs.",
  );
  await expect(
    bar(page).getByRole("button", { name: "Next step" }),
  ).toHaveCount(0);
  await show(page, askRight);
  await event(page, "q.2", "answer.right");
  await expect(pip(page)).toHaveAttribute("data-pip-reaction", "q.2");
  await expect(bubble(page)).toHaveText("That's right.");
  await expect(card(page).locator("[data-state=right]")).toContainText(
    "CLAUDE.md",
  );
  await expect(
    bar(page).getByRole("button", { name: "Next step" }),
  ).toBeVisible();
  await namesNoKey(page);
});

test("after a wrong answer, Show the answer sends answer.reveal and marks it", async ({
  page,
}) => {
  const sent = actionsOf(page);
  await openAt(page, askWrong);
  await card(page).getByRole("button", { name: "Show the answer" }).click();
  await expect.poll(() => sent).toEqual([{ type: "answer.reveal" }]);
  await show(page, askRevealed);
  await expect(bubble(page)).toHaveText("Here is the answer.");
  await expect(card(page).locator("[data-state=shown]")).toContainText(
    "The answer",
  );
  await expect(
    card(page).getByRole("button", { name: "Show the answer" }),
  ).toHaveCount(0);
});

test("a typed answer sends its text from the keyboard, and stays to edit after a miss", async ({
  page,
}) => {
  const sent = actionsOf(page);
  await openAt(page, typeBeat);
  const box = card(page).getByRole("textbox", {
    name: "Which command shows the session's cost?",
  });
  await expect(box).toHaveAttribute("maxlength", "200");
  await box.fill("usage");
  await box.press("Enter");
  await expect
    .poll(() => sent)
    .toEqual([{ type: "answer.type", text: "usage" }]);
  await show(page, typeWrong);
  await event(page, "t.1", "answer.wrong");
  await expect(pip(page)).toHaveAttribute("data-pip-reaction", "t.1");
  await expect(box).toHaveValue("usage");
  await expect(card(page).locator("[data-answer-because]")).toHaveText(
    "It starts with a slash.",
  );
});

test("a choice that shows later beats is drawn chosen, then Next step", async ({
  page,
}) => {
  await openAt(page, whenOption);
  await expect(card(page).locator("[data-state=chosen]")).toContainText("zsh");
  await expect(
    bar(page).getByRole("button", { name: "Next step" }),
  ).toBeVisible();
});

test("a warm-up names the Lesson it looks back at", async ({ page }) => {
  await openAt(page, warmupAsk);
  await expect(card(page).locator("[data-warmup]")).toContainText(
    "A quick look back at Install, sign in and look around.",
  );
});

test("the waiting question answers or puts away, and stays read only once the wait ends", async ({
  page,
}) => {
  const sent = actionsOf(page);
  await openAt(page, waitQuestionOpen);
  const question = page.locator("[data-wait-question]");
  await expect(question).toContainText("While you wait");
  await question.getByText("README.md").click();
  await question.getByRole("button", { name: "Check my answer" }).click();
  await expect
    .poll(() => sent)
    .toContainEqual({
      type: "waitQuestion.answer",
      option: 1,
    });
  await show(page, waitQuestionEnded);
  await expect(question).toContainText("Your result is in.");
  for (const radio of await question.getByRole("radio").all())
    await expect(radio).toHaveAttribute("aria-disabled", "true");

  await show(page, waitQuestionOpen);
  await question.getByRole("button", { name: "Not now" }).click();
  await expect(question).toHaveCount(0);
});

/** What has focus: a radio's answer, a button's or a box's name. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return "";
    if (el instanceof HTMLInputElement && el.type === "radio")
      return `radio:${el.closest("label")?.textContent ?? ""}`;
    return el.getAttribute("aria-label") ?? el.textContent.trim();
  });

test("by keyboard alone: every answer, the send, the reveal and each hint control", async ({
  page,
}) => {
  const sent = actionsOf(page);
  await openAt(page, askWrong);
  await card(page).getByRole("radio").first().focus();
  expect(await focused(page)).toMatch(/^radio:/);
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  // Moving between answers sends nothing.
  expect(sent).toEqual([]);
  expect(await focused(page)).toMatch(/^radio:.*The settings file/);
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBe("Check my answer");
  await page.keyboard.press("Enter");
  await expect.poll(() => sent).toEqual([{ type: "answer.pick", option: 2 }]);
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBe("Show the answer");
  await page.keyboard.press("Space");
  await expect.poll(() => sent).toHaveLength(2);
  expect(sent[1]).toEqual({ type: "answer.reveal" });

  // The hints: Show a hint opens a rung, which takes focus.
  await show(page, watching);
  const show1 = page.getByRole("button", { name: "Show a hint" });
  await show1.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => sent.at(-1)).toEqual({ type: "hint.next" });
  await expect(page.locator("[data-pip-target=hint]")).toBeFocused();
  await expect(page.locator("[data-pip-target=hint]")).toContainText(
    hinted.hints.shown[0]?.kind === "check" ? hinted.hints.shown[0].text : "",
  );

  // The exact-command question takes focus, and both answers work by key.
  await show(page, confirmExact);
  await expect(page.locator("[data-hints-confirm] p")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBe("Show the exact command");
  await page.keyboard.press("Tab");
  expect(await focused(page)).toBe("Not now");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => sent.at(-1))
    .toEqual({
      type: "hint.takeExact",
      take: false,
    });
  await page.keyboard.press("Shift+Tab");
  expect(await focused(page)).toBe("Show the exact command");
  // Not now's answer has landed: the take is no longer held in flight.
  await expect(
    page.getByRole("button", { name: "Show the exact command" }),
  ).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Space");
  await expect
    .poll(() => sent.at(-1))
    .toEqual({
      type: "hint.takeExact",
      take: true,
    });

  // The exact command's rung has its Copy, reachable by Tab.
  await show(page, exactTaken);
  const copy = page
    .locator("[data-hint-rung]")
    .last()
    .getByRole("button", { name: /^Copy / });
  await copy.focus();
  await expect(copy).toBeFocused();
});
