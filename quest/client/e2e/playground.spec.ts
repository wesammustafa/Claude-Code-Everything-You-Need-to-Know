// The Pip Playground on the dev server (it is development-only): every
// control is reached with Tab and works with the keyboard alone.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEV } from "../playwright.config.ts";

test.use({ baseURL: DEV });

const PLAYGROUND = "/#/playground";

async function open(page: Page) {
  await page.goto(PLAYGROUND);
  await expect(
    page.getByRole("heading", { level: 1, name: "Pip Playground" }),
  ).toBeVisible({ timeout: 30_000 });
}

const controls = (page: Page) => page.getByRole("complementary");
const field = (page: Page, name: string) =>
  page.locator(`[data-playground-model] [data-field="${name}"]`);
const livePip = (page: Page) =>
  page.locator('[data-playground-stage="live"] [data-pip]');
const log = (page: Page) =>
  page.getByRole("log", { name: "What the director did" });

/**
 * A key for each Tab stop the controls should have: every button and select,
 * each range that is enabled, and each radio group once.
 */
async function tabStops(region: Locator): Promise<string[]> {
  return region.evaluate((root) => {
    const keys = new Set<string>();
    root
      .querySelectorAll<HTMLElement>("button, select, input")
      .forEach((el, i) => {
        if (el instanceof HTMLInputElement && el.type === "radio")
          keys.add(`radio:${el.name}`);
        else if (!(el as HTMLInputElement).disabled)
          keys.add(`el:${String(i)}`);
      });
    return [...keys];
  });
}

/**
 * Tabs from the page's heading through the controls, which come next, and
 * returns the Tab stops it reached there. The page records each stop as
 * focus lands, so a Tab press costs one round trip, not two.
 */
async function tabbed(page: Page, region: Locator): Promise<string[]> {
  await region.evaluate((root) => {
    const reached: (string | null)[] = [];
    Object.assign(window, { reached });
    const note = () => {
      const el = document.activeElement;
      if (el === null || !root.contains(el)) reached.push(null);
      else if (el instanceof HTMLInputElement && el.type === "radio")
        reached.push(`radio:${el.name}`);
      else {
        const controls = [...root.querySelectorAll("button, select, input")];
        reached.push(`el:${String(controls.indexOf(el))}`);
      }
    };
    // One recorder at a time: a second call replaces the first.
    const previous = (window as unknown as { stopNoting?: () => void })
      .stopNoting;
    previous?.();
    document.addEventListener("focusin", note);
    // Focus leaving for the browser's own UI fires no focusin: blur notes it.
    window.addEventListener("blur", note);
    Object.assign(window, {
      stopNoting: () => {
        document.removeEventListener("focusin", note);
        window.removeEventListener("blur", note);
      },
    });
  });
  // The heading takes focus from script only, and comes before the controls,
  // so the next Tab lands on the first control.
  await page.getByRole("heading", { level: 1 }).focus();
  const read = () =>
    page.evaluate(
      () => (window as unknown as { reached: (string | null)[] }).reached,
    );
  // The heading's own focus is not a stop.
  await page.evaluate(() => {
    (window as unknown as { reached: unknown[] }).reached.length = 0;
  });
  // The stops up to the first focus outside the controls after reaching
  // them; null while the controls have not been reached or have been left.
  const within = (keys: (string | null)[]): string[] | null => {
    const first = keys.findIndex((k) => k !== null);
    if (first === -1) return null;
    const end = keys.indexOf(null, first);
    return end === -1 ? null : (keys.slice(first, end) as string[]);
  };
  for (let i = 0; i < 200; i += 1) {
    await page.keyboard.press("Tab");
    // Check for having left the controls every 10 presses, not every press.
    if (i % 10 === 9 && within(await read()) !== null) break;
  }
  const keys = await read();
  return [...new Set(within(keys) ?? keys.filter((k) => k !== null))];
}

test("every control is a Tab stop, for both sources", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  const region = controls(page);
  // The gaze ranges are enabled once the gaze is set.
  await page.getByRole("switch", { name: /Set the gaze/ }).click();
  expect((await tabbed(page, region)).sort()).toEqual(
    (await tabStops(region)).sort(),
  );

  await page.getByRole("radio", { name: "The model" }).focus();
  await page.keyboard.press("ArrowRight");
  const stops = await tabStops(region);
  expect(stops.length).toBeGreaterThan(40);
  expect((await tabbed(page, region)).sort()).toEqual(stops.sort());
});

test("the model's controls work with the keyboard", async ({ page }) => {
  test.setTimeout(60_000);
  await open(page);
  const keys = page.keyboard;

  // Mode: arrows move the choice.
  await page.getByRole("radio", { name: "Idle" }).focus();
  await keys.press("ArrowRight");
  await expect(field(page, "mode")).toHaveText("thinking");
  await keys.press("ArrowRight");
  await expect(field(page, "mode")).toHaveText("rest");

  // Intensity: Home, End and the arrows; then a mark's button.
  const intensity = page.getByRole("slider", { name: /Intensity/ });
  await intensity.focus();
  await keys.press("Home");
  await expect(intensity).toHaveValue("0");
  await keys.press("ArrowRight");
  await expect(intensity).toHaveValue("0.05");
  await keys.press("End");
  await expect(intensity).toHaveValue("1");
  await page
    .getByRole("button", { name: "Intensity 0.5", exact: true })
    .focus();
  await keys.press("Space");
  await expect(intensity).toHaveValue("0.5");

  // A Reaction plays at that intensity, on the live Pip and the poster.
  await page.getByRole("button", { name: "Retry" }).focus();
  await keys.press("Enter");
  await expect(field(page, "reaction")).toHaveText("retry at 0.5");
  await expect(livePip(page)).toHaveAttribute("data-pip-reaction", /#live$/);

  // Gaze: off until set; then the ranges and the presets.
  await expect(field(page, "gaze")).toHaveText("null");
  const setGaze = page.getByRole("switch", { name: /Set the gaze/ });
  await setGaze.focus();
  await keys.press("Space");
  await expect(setGaze).toHaveAttribute("aria-checked", "true");
  await page.getByRole("slider", { name: /gazeX/ }).focus();
  await keys.press("ArrowRight");
  await expect(field(page, "gaze")).toHaveText("0.05, 0.00");
  await page.getByRole("slider", { name: /gazeY/ }).focus();
  await keys.press("ArrowLeft");
  await expect(field(page, "gaze")).toHaveText("0.05, -0.05");
  for (const [name, gaze] of [
    ["Left", "-1.00, 0.00"],
    ["Right", "1.00, 0.00"],
    ["Toward the step", "0.40, 0.00"],
    ["Up", "0.00, -1.00"],
    ["Down", "0.00, 1.00"],
    ["Forward", "0.00, 0.00"],
  ] as const) {
    await page.getByRole("button", { name, exact: true }).focus();
    await keys.press("Enter");
    await expect(field(page, "gaze")).toHaveText(gaze);
  }

  // Size: hero, beside, then the static icon.
  await page.getByRole("radio", { name: "Hero" }).focus();
  await keys.press("ArrowRight");
  await expect(livePip(page)).toHaveAttribute("data-pip", "beside");
  await keys.press("ArrowRight");
  await expect(field(page, "size")).toHaveText("icon");
  await expect(livePip(page)).toHaveCount(0);
  await keys.press("ArrowLeft");
  await keys.press("ArrowLeft");
  await expect(livePip(page)).toHaveAttribute("data-pip", "hero");

  // Theme: system, dark, light, on <html>.
  const html = page.locator("html");
  await page.getByRole("radio", { name: "System" }).focus();
  await keys.press("ArrowRight");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await keys.press("ArrowRight");
  await expect(html).toHaveAttribute("data-theme", "light");

  // Reduced motion: the model's flag and the page's motion setting.
  const reduced = page.getByRole("switch", { name: /Reduced motion/ });
  await reduced.focus();
  await keys.press("Space");
  await expect(field(page, "reducedMotion")).toHaveText("true");
  await expect(html).toHaveAttribute("data-motion", "reduce");
  await keys.press("Enter");
  await expect(field(page, "reducedMotion")).toHaveText("false");

  // Rive unavailable: the live Pip keeps its poster for good, then the rig returns.
  await expect(livePip(page)).toHaveAttribute("data-pip-rendering", "rig", {
    timeout: 20_000,
  });
  const rive = page.getByRole("switch", { name: /Rive available/ });
  await rive.focus();
  await keys.press("Space");
  await expect(livePip(page)).toHaveAttribute(
    "data-pip-rendering",
    "unavailable",
  );
  await keys.press("Space");
  await expect(livePip(page)).toHaveAttribute("data-pip-rendering", "rig", {
    timeout: 20_000,
  });
});

test("the director's controls work with the keyboard", async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  const keys = page.keyboard;
  await page.getByRole("radio", { name: "The model" }).focus();
  await keys.press("ArrowRight");
  await expect(log(page)).toBeVisible();

  // Every event, scenario and clock button adds to the log.
  const region = controls(page);
  const buttons = region.locator("button:not([role=switch])");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(30);
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    const label = (await button.innerText()).split("\n")[0] ?? "";
    // The gaze presets set targets, which the log does not show.
    if (["Left", "Forward", "Right", "Toward the step"].includes(label))
      continue;
    const before = await log(page).innerText();
    await button.focus();
    await keys.press("Enter");
    await expect(log(page), label).not.toHaveText(before);
  }

  // A scenario plays to its end: a Retry replaces a Success.
  await page.getByRole("button", { name: /Retry during a Success/ }).focus();
  await keys.press("Enter");
  await expect(log(page).locator("li").first()).toContainText(
    "Retry plays at 0.5",
  );

  // The screen, and each switch the browser would flip.
  // Typing an option's first letter picks it, on every platform (an arrow
  // key opens the menu on macOS).
  const screen = page.getByRole("combobox", { name: "Screen" });
  await screen.focus();
  await keys.press("w");
  await expect(screen).toHaveValue("welcome");
  await expect(log(page).locator("li").first()).toContainText(
    "Screen: welcome",
  );
  for (const [name, entry] of [
    ["Lesson page panel open", "Page panel opened"],
    ["Page hidden", "Page hidden"],
    ["Pip off-screen", "Pip scrolled away"],
    ["Reconnecting", "Reconnecting"],
  ] as const) {
    await page.getByRole("switch", { name }).focus();
    await keys.press("Space");
    await expect(log(page).locator("li").first()).toContainText(entry);
  }
  await expect(field(page, "mode")).toHaveText("rest");
});
