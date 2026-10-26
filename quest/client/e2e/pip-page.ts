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

/** The Lesson's controls answer: the step outline opens and closes, and Next step moves on. */
export async function lessonUsable(page: Page) {
  await page.getByRole("button", { name: "Steps" }).click();
  const outline = page.getByRole("dialog", { name: "Steps" });
  await expect(outline).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(outline).toBeHidden();
  await page.getByRole("link", { name: "Next step" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Install, sign in and look around",
  );
}
