// Hint unlocking and help fading (247 AC1), and a wrong then right answer
// (AC2), on the real engine, host and server in a Practice copy: a
// Challenge step's hints wait for a first try; taking the exact command
// eases the skill, and the help lands on a later step; help fades across
// Lessons as the engine's rules say.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { bar, heading, lessonsBefore, move, saveAt } from "./play.ts";
import { practiceCopy, repoRoot, type PracticeCopy } from "./practice-copy.ts";

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 1280, height: 900 } });
// Copying the template, replaying the Lessons and starting the app.
test.setTimeout(120_000);

/** Welcome's Continue, to the saved step. */
async function openAt(page: Page, copy: PracticeCopy) {
  await page.goto(copy.url);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Starts a copy saved at `id`'s `step`, runs `body`, and cleans up. */
async function at(
  page: Page,
  [id, step, beat]: [string, string, number],
  body: (copy: PracticeCopy) => Promise<void>,
  through?: string,
  edit?: (save: { lessons: Record<string, unknown> }) => void,
) {
  const copy = practiceCopy(through === undefined ? {} : { through });
  try {
    const save = JSON.parse(saveAt(id, step, beat)) as {
      lessons: Record<string, unknown>;
    };
    edit?.(save);
    copy.write(".practice/learn.json", JSON.stringify(save));
    await copy.start();
    await openAt(page, copy);
    await body(copy);
  } finally {
    await copy.dispose();
  }
}

const tierOf = (page: Page) =>
  page.locator("[data-step-card] header [data-tier]").first();

test("a Challenge step's hints wait for a first try, then open", async ({
  page,
}) => {
  await at(page, ["b-1", "Y3", 0], async () => {
    await expect(heading(page)).toHaveText("Correct one claim");
    await expect(tierOf(page)).toHaveAttribute("data-tier", "challenge");
    const waits = page.locator("[data-hints-unavailable]");
    await expect(waits).toHaveText("Hints open once you have run Check again.");
    await expect(page.getByRole("button", { name: "Show a hint" })).toHaveCount(
      0,
    );
    await bar(page).getByRole("button", { name: "Check again" }).click();
    await expect(page.locator("main [data-state=not-yet]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(waits).toHaveCount(0);
    await page.getByRole("button", { name: "Show a hint" }).click();
    await expect(page.locator("[data-hint-rung]")).toHaveCount(1);
    await expect(page.locator("[data-pip-target=hint]")).toBeFocused();
  });
});

test("taking the exact command asks first and eases the step's skill", async ({
  page,
}) => {
  await at(
    page,
    ["b-5", "W4", 0],
    async (copy) => {
      await expect(heading(page)).toHaveText("Load the new rule");
      const confirm = page.locator("[data-hints-confirm]");
      const next = page.getByRole("button", {
        name: /^(Show a hint|Another hint)$/,
      });
      for (let i = 0; i < 8 && !(await confirm.isVisible()); i += 1) {
        await next.click();
        await expect(next.or(confirm)).toBeVisible();
      }
      await expect(confirm.locator("p")).toBeFocused();
      await expect(confirm).toContainText(
        "Show the exact command? This step then counts as Every command shown.",
      );
      const rungs = await page.locator("[data-hint-rung]").count();
      // Not now: no rung opens and nothing is eased.
      await confirm.getByRole("button", { name: "Not now" }).click();
      await expect(confirm).toHaveCount(0);
      await expect(page.locator("[data-hint-rung]")).toHaveCount(rungs);
      // Asked again, then taken: the rung shows the command with Copy.
      await next.click();
      await expect(confirm).toBeVisible();
      await confirm
        .getByRole("button", { name: "Show the exact command" })
        .click();
      await expect(page.locator("[data-hint-rung]")).toHaveCount(rungs + 1);
      await expect(
        page
          .locator("[data-hint-rung]")
          .last()
          .getByRole("button", { name: /^Copy / }),
      ).toBeVisible();
      await expect
        .poll(() => (copy.saved() as { eased?: unknown } | null)?.eased)
        .toEqual(["start"]);
    },
    "b-5",
  );
});

// Where a saved ease lands (engine/test/lesson-flow-help.test.mjs, "an ease
// lands only where it changes the help"): b-5 Y1, Hinted on the plan, opens
// Guided with its more-help line. b-5 has no later step on W4's skill
// (start), so the landing is shown from a saved ease on Y1's skill.
test("a saved ease lands where it changes the help: b-5 Y1 opens Guided, with more help", async ({
  page,
}) => {
  await at(
    page,
    ["b-5", "Y1", 0],
    async () => {
      await expect(heading(page)).toHaveText("Sort and verify the notes");
      await expect(tierOf(page)).toHaveAttribute("data-tier", "guided");
      await expect(page.locator("[data-extra-help]")).toBeVisible();
    },
    "b-4",
    (save) => {
      Object.assign(save, { eased: ["memory"] });
    },
  );
});

/** Lesson `id`'s step ids, from its step file. */
function stepIds(id: string): string[] {
  const file = readFileSync(join(repoRoot, "course/steps", `${id}.md`), "utf8");
  return [...file.matchAll(/^### ([^ |]+) \|/gm)].map((m) => m[1] ?? "");
}

// Fading counts only what this Learner did (tiers.ts ruleTiers, and
// engine/test/lesson-flow-help.test.mjs "fading counts only what this
// learner did"): b-3 W3's skill, ask, was practised in b-1 and b-2, so
// with their steps done it gives less help than with the Lessons only
// marked complete.
test("help fades across Lessons with what this Learner did: b-3 W3 gives less help after b-1 and b-2's steps", async ({
  page,
}) => {
  const rank = ["guided", "hinted", "challenge"];
  const tierWith = async (done: boolean) => {
    let tier = "";
    await at(
      page,
      ["b-3", "W3", 0],
      async () => {
        await expect(heading(page)).toHaveText("Ask without steering");
        tier = (await tierOf(page).getAttribute("data-tier")) ?? "";
      },
      undefined,
      (save) => {
        if (done)
          for (const id of lessonsBefore("b-3"))
            save.lessons[id] = { complete: true, done: stepIds(id) };
      },
    );
    return tier;
  };
  const fresh = await tierWith(false);
  const practised = await tierWith(true);
  expect(rank.indexOf(practised)).toBeGreaterThan(rank.indexOf(fresh));
});

test("b-1 W4: a wrong answer keeps the step and plays Retry; the right one plays Success", async ({
  page,
}) => {
  await at(page, ["b-1", "W4", 0], async () => {
    await expect(heading(page)).toHaveText("Compare the session");
    const card = page.locator("[data-step-card]");
    const pip = page.locator("main [data-pip]").first();
    await card.getByText("Your Claude Code versions").click();
    await card.getByRole("button", { name: "Check my answer" }).click();
    await expect(card.locator("[data-state=notYet]")).toContainText(
      "Your Claude Code versions",
    );
    await expect(page.locator("[data-says-words]")).toHaveText(
      "Not yet. Try another answer.",
    );
    await expect(pip).toHaveAttribute("data-pip-reaction", /.+/);
    const retry = await pip.getAttribute("data-pip-reaction");
    await expect(heading(page)).toHaveText("Compare the session");
    await card.getByText("The account each of you signed in with").click();
    await card.getByRole("button", { name: "Check my answer" }).click();
    await expect(page.locator("[data-says-words]")).toHaveText("That's right.");
    await expect(pip).not.toHaveAttribute("data-pip-reaction", retry ?? "");
    await expect(card.locator("[data-state=right]")).toBeVisible();
    // The step goes on to its next beat.
    await move(page);
  });
});
