// Pip's mode follows the b-1 step states on a real play (rehoming row 160,
// 254 D22+): on the built app in a fresh Practice copy, Pip is Idle on the
// waiting card, Thinking from check.started to the result, and Idle again once it says
// Not yet, could not run (broken) or passed (done). The director's mode is
// read from `data-pip-mode` on Pip's element. It reuses rehomed.spec.ts's
// helpers from their modules (play.ts, practice-copy.ts).
import { renameSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { bar, heading, saveAt } from "./play.ts";
import { practiceCopy } from "./practice-copy.ts";

test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(120_000);

/** b-1's note with its wrong claim corrected (b1-slice.spec.ts). */
const CORRECTED =
  "- linkcheck exits with code 1 when it finds broken links, so it can fail a CI job.\n";

const pip = (page: Page) => page.locator("[data-pip=beside]");
const card = (page: Page) => page.locator("[data-pip-target=lines] li").last();

/**
 * Records every mode Pip's element holds from the page's opening on, each
 * change once, in `window.__modes`. The mode follows the event feed
 * (check.started until the result, spec Reaction map), which lands after the
 * snapshot's Checking words, so it is read over the whole play rather than
 * while the bubble says Checking. A batch of mutations can hold more than one
 * change of the mode: each record's old value is the mode the one before it
 * set, so a short Thinking is never lost between two reads.
 */
function recordModes(page: Page) {
  return page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __modes: string[] }).__modes = seen;
    const note = (mode: string | null | undefined) => {
      if (mode && seen.at(-1) !== mode) seen.push(mode);
    };
    new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.attributeName === "data-pip-mode" &&
          (record.target as Element).matches("[data-pip=beside]")
        )
          note(record.oldValue);
      }
      note(
        document
          .querySelector("[data-pip=beside]")
          ?.getAttribute("data-pip-mode"),
      );
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-pip", "data-pip-mode"],
      attributeOldValue: true,
    });
  });
}

const modes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __modes: string[] }).__modes);

/**
 * Where Pip's Idle stands in the record while Pip is at rest; -1 while it
 * isn't.
 */
const restingAt = (page: Page) =>
  page.evaluate(() => {
    const seen = (window as unknown as { __modes: string[] }).__modes;
    return seen.at(-1) === "idle" ? seen.length - 1 : -1;
  });

/** Idle, Thinking while the run is out, then the line's state and Idle. */
async function checkTo(page: Page, state: string, run: () => Promise<void>) {
  // A run the file watcher started on an earlier change (the folder renamed
  // away or back) may still be out: let it finish, so the record is read
  // from Pip at rest. The record runs from the page's opening, so a run the
  // watcher starts only after this rest is read in it too (335). Either run
  // may be the one Pip thinks through: the watcher's run on a change is a
  // Check run too (254 D25), so either shows the mode follows the run.
  let rest = -1;
  await expect
    .poll(async () => (rest = await restingAt(page)), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(0);
  await run();
  await expect(card(page)).toHaveAttribute("data-state", state, {
    timeout: 30_000,
  });
  // Idle again after Thinking, read from the record: the watcher may start
  // one more run for the same change once this one has ended, so Pip's mode
  // now could be that run's Thinking. The record from `rest` on starts at
  // Idle, so only a Thinking and the Idle after it are left to find.
  await expect
    .poll(
      async () => {
        const seen = (await modes(page)).slice(rest);
        const thought = seen.indexOf("thinking");
        return thought !== -1 && seen.indexOf("idle", thought) !== -1;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

const checkAgain = (page: Page) => () =>
  bar(page).getByRole("button", { name: "Check again" }).click();

test("Pip's mode follows b-1's step states on a real play: rest, checking, Not yet, broken and done (row 160)", async ({
  page,
}) => {
  const copy = practiceCopy();
  try {
    copy.write(".practice/learn.json", saveAt("b-1", "Y3", 0));
    await copy.start();
    await recordModes(page);
    await page.goto(copy.url);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(heading(page)).toHaveText("Correct one claim");

    // The card at rest: until the learner runs the Check, its line is
    // waiting, not Not yet (344). Once the step's opening look has its
    // answer (Pip thinks while it runs), Pip holds Idle.
    await expect(card(page)).toHaveAttribute("data-state", "waiting", {
      timeout: 30_000,
    });
    await expect(pip(page)).toHaveAttribute("data-pip-mode", "idle", {
      timeout: 30_000,
    });

    await checkTo(page, "not-yet", checkAgain(page));

    // The folder the Check runs in is gone: it cannot run.
    const project = join(copy.dir, "project");
    renameSync(project, `${project}.away`);
    await checkTo(page, "broken", checkAgain(page));
    renameSync(`${project}.away`, project);

    // The correction alone passes it: the run the file watcher starts on
    // the change is a Check run, so Pip thinks for it too (254 D25). No
    // Check again: the run may pass first, and the button becomes Next step.
    await checkTo(page, "ok", () => {
      copy.write("project/practice/b-1/onboarding.md", CORRECTED);
      return Promise.resolve();
    });
    await expect(
      bar(page).getByRole("button", { name: "Next step" }),
    ).toBeVisible();
  } finally {
    await copy.dispose();
  }
});
