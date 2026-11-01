// Pip's mode follows the b-1 step states on a real play (rehoming row 160,
// 254 D22+): on the built app in a fresh Practice copy, Pip is Idle on the
// waiting card, Thinking while the Check runs, and Idle again once it says
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

/** Every mode Pip's element held while the bubble said Checking, from now on. */
async function watchChecking(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __modes: string[] }).__modes = seen;
    const look = () => {
      const words =
        document.querySelector("[data-says-words]")?.textContent ?? "";
      const mode = document
        .querySelector("[data-pip=beside]")
        ?.getAttribute("data-pip-mode");
      if (/^Checking/.test(words) && mode) seen.push(mode);
    };
    new MutationObserver(look).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  });
}

const checkingModes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __modes: string[] }).__modes);

/** Check again, Thinking while it runs, then the line's state and Idle. */
async function checkTo(page: Page, state: string) {
  await watchChecking(page);
  await bar(page).getByRole("button", { name: "Check again" }).click();
  await expect(card(page)).toHaveAttribute("data-state", state, {
    timeout: 30_000,
  });
  await expect
    .poll(() => checkingModes(page), { timeout: 30_000 })
    .toContain("thinking");
  await expect(pip(page)).toHaveAttribute("data-pip-mode", "idle");
}

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

    await checkTo(page, "not-yet");

    // The folder the Check runs in is gone: it cannot run.
    const project = join(copy.dir, "project");
    renameSync(project, `${project}.away`);
    await checkTo(page, "broken");
    renameSync(`${project}.away`, project);

    copy.write("project/practice/b-1/onboarding.md", CORRECTED);
    await checkTo(page, "ok");
    await expect(
      bar(page).getByRole("button", { name: "Next step" }),
    ).toBeVisible();
  } finally {
    await copy.dispose();
  }
});
