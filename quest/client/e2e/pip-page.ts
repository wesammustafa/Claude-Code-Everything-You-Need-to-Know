// What the Pip e2e specs share: the Lesson step screen, the files Pip's
// runtime loads, Pip on the page, and a check that the Lesson still answers.
import { expect, type Page } from "@playwright/test";

/** The b-1 Lesson's step screen, with Pip beside the step. */
export const STEP = "/#/lesson/b-1/step";
export const RUNTIME = /\/assets\/PipRive-[\w-]+\.js$/;
export const WASM = /\/assets\/rive-[\w-]+\.wasm$/;
export const RIG = /\/assets\/pip-[\w-]+\.riv$/;

/** Pip on the page, at the beside or hero size. */
export const pip = (page: Page) => page.locator("[data-pip]");

/** The Lesson's controls answer: the step outline opens and closes, and Check again sends its action. */
export async function lessonUsable(page: Page) {
  await page.getByRole("button", { name: "Steps" }).click();
  const outline = page.getByRole("dialog", { name: "Steps" });
  await expect(outline).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(outline).toBeHidden();
  // The step's main action sends its action (the page's fake answers it).
  const sent = page.waitForRequest("**/api/actions");
  await page.getByRole("button", { name: "Check again" }).click();
  expect((await sent).postDataJSON()).toMatchObject({
    action: { type: "check.run" },
  });
}
