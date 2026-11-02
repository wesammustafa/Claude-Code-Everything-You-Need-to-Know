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
 * Every mode Pip's element holds from now on, starting with the current one.
 * The mode follows the event feed (check.started until the result, spec
 * Reaction map), which lands after the snapshot's Checking words, so it is
 * read over the whole run rather than while the bubble says Checking.
 */
async function watchModes(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __modes: string[] }).__modes = seen;
    const look = () => {
      const mode = document
        .querySelector("[data-pip=beside]")
        ?.getAttribute("data-pip-mode");
      if (mode && seen.at(-1) !== mode) seen.push(mode);
    };
    look();
    new MutationObserver(look).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-pip-mode"],
    });
  });
}

const modes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __modes: string[] }).__modes);

/** Idle, Thinking while the run is out, then the line's state and Idle. */
async function checkTo(page: Page, state: string, run: () => Promise<void>) {
  // A run the file watcher started on an earlier change (the folder renamed
  // back) may still be out: let it finish so the watch starts at rest.
  await expect(pip(page)).toHaveAttribute("data-pip-mode", "idle", {
    timeout: 30_000,
  });
  await watchModes(page);
  await run();
  await expect(card(page)).toHaveAttribute("data-state", state, {
    timeout: 30_000,
  });
  await expect
    .poll(
      async () => {
        const seen = await modes(page);
        const thought = seen.indexOf("thinking");
        return (
          seen[0] === "idle" &&
          thought > 0 &&
          seen.indexOf("idle", thought) > thought
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  await expect(pip(page)).toHaveAttribute("data-pip-mode", "idle");
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
    await page.goto(copy.url);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(heading(page)).toHaveText("Correct one claim");

    // The card at rest: Pip holds Idle.
    await expect(pip(page)).toHaveAttribute("data-pip-mode", "idle");

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
