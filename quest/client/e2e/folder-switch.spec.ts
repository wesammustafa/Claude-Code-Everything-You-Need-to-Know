// Switching Work folders in the browser (rehoming row 671, ticket 254 D23
// and D28): a real Practice copy with one Work folder saved for
// Intermediate, switched to a second folder through Settings
// (folder.choose): on i-2's overview, its folder line; with i-2 open at a
// Your turn step in a terminal, the waiting bubble (beat.watches) and the
// step card's Where line. Each then names the new folder, none the old.
import { expect, test, type Page } from "@playwright/test";
import { practiceCopy, type PracticeCopy } from "./practice-copy.ts";
import { openLesson, saveAt, saveBefore } from "./play.ts";

const folders = (copy: PracticeCopy) =>
  (copy.saved() as { folders?: Record<string, string> } | null)?.folders ?? {};

test.use({ viewport: { width: 1280, height: 900 } });
// Copying the template and starting the app, on a busy machine.
test.setTimeout(90_000);

/** Changes Intermediate's Work folder in Settings, as a Learner does. */
async function switchTo(page: Page, copy: PracticeCopy, to: string) {
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const region = dialog.getByRole("region", { name: "Work folders" });
  const row = region.locator("[data-work-folder='intermediate']");
  await row.getByRole("button", { name: /Change/ }).click();
  await region.getByRole("radio", { name: /another folder/ }).click();
  await region.getByRole("textbox").fill(to);
  await region.getByRole("button", { name: "Use this folder" }).click();
  await expect.poll(() => folders(copy).intermediate).toBe(to);
  await expect(row).toContainText(to);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

/** Every text Pip's bubble says from now on, in order, each change once. */
async function noteBubble(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const said: string[] = [];
    const note = () => {
      const text =
        document.querySelector("main [role=status][aria-live=polite]")
          ?.textContent ?? "";
      if (said.at(-1) !== text) said.push(text);
    };
    note();
    Object.assign(window, { bubbleSaid: said });
    new MutationObserver(note).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { bubbleSaid: string[] }).bubbleSaid,
    );
}

test("after folder.choose, the waiting bubble and the Where line name the new Work folder", async ({
  page,
}) => {
  const copy = practiceCopy({});
  try {
    const first = copy.repo("first");
    const second = copy.repo("second");
    copy.write(
      ".practice/learn.json",
      saveAt("i-2", "Y2", 0, { intermediate: first }),
    );
    await copy.start();
    // The saved step opens on the workspace, watching the first folder.
    await page.goto(copy.url);
    await page
      .getByRole("button", { name: /^Continue/ })
      .first()
      .click();
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Read a source file");
    const bubble = page.locator("main [role=status][aria-live=polite]");
    const where = page.locator("main [data-where]");
    await expect(bubble).toHaveText(`Watching your work folder: ${first}.`);
    await expect(where).toContainText(`in ${first}`);

    const said = await noteBubble(page);
    await switchTo(page, copy, second);

    await expect(heading).toHaveText("Read a source file");
    await expect(bubble).toHaveText(`Watching your work folder: ${second}.`);
    await expect(where).toContainText(`in ${second}`);
    await expect(page.locator("main")).not.toContainText(first);
    // Once switched, the bubble never names the old folder again.
    const after = await said();
    const switched = after.findIndex((t) => t.includes(second));
    expect(after.slice(switched).filter((t) => t.includes(first))).toEqual([]);
  } finally {
    await copy.dispose();
  }
});

test("after folder.choose, the overview's folder line names the new Work folder", async ({
  page,
}) => {
  const copy = practiceCopy({});
  try {
    const first = copy.repo("first");
    const second = copy.repo("second");
    copy.write(
      ".practice/learn.json",
      saveBefore("i-2", { intermediate: first }),
    );
    await copy.start();
    await openLesson(page, copy);
    await expect(page.locator("[data-overview-folder]")).toHaveText(
      `Work folder: ${first}`,
    );
    await switchTo(page, copy, second);
    // Answered on this lesson, the line is the answered question's slot
    // (asksHere: folderAnswered), with its Change button; it reads the same.
    await expect(
      page.getByRole("region", { name: "Work folder" }).getByRole("paragraph"),
    ).toHaveText(`Work folder: ${second}Change`);
    await expect(page.locator("main")).not.toContainText(first);
  } finally {
    await copy.dispose();
  }
});
