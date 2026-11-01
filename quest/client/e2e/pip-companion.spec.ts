// Pip as a companion: he rests turned toward the content beside it and
// facing the Learner when centred, watches a copied command, offers the
// step's hint when the step seems stuck, and sits beside the Next band on the
// Learning journey and beside the skills on Progress, covering nothing.
import type { Locator, Page } from "@playwright/test";
import { expect, sendEvents, test } from "./live.ts";
import { STEP, pip } from "./pip-page.ts";
import { watch } from "./watch.ts";

const REST = "0.40 0.00";
const FORWARD = "0.00 0.00";
const OFFER = "A hint is here if you want it.";

/** The gaze the adapter writes to the rig, as numbers. */
async function gaze(page: Page): Promise<[number, number]> {
  const value = (await pip(page).getAttribute("data-pip-gaze")) ?? "";
  const [x = NaN, y = NaN] = value.split(" ").map(Number);
  return [x, y];
}

let sequence = 0;

/** One revision's events, on the page's stream. */
async function send(
  page: Page,
  ...events: { id: string; [field: string]: unknown }[]
) {
  await sendEvents(
    page,
    events.map((event) => ({ revision: 1, serverTime: Date.now(), ...event })),
  );
}

const notYet = () => ({
  id: `c.${String((sequence += 1))}`,
  type: "check.notYet",
  evidence: "No commit yet",
});

/** Every text Pip's bubble says from now on, in order, each change once. */
async function noteBubble(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const bubble = document.querySelector(
      "main [role=status][aria-live=polite]",
    );
    const said: string[] = [bubble?.textContent ?? ""];
    Object.assign(window, { bubbleSaid: said });
    if (bubble === null) return;
    new MutationObserver(() => {
      const text = bubble.textContent;
      if (said.at(-1) !== text) said.push(text);
    }).observe(bubble, { subtree: true, childList: true, characterData: true });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { bubbleSaid: string[] }).bubbleSaid,
    );
}

/** Once the screen's entrance has finished: every animation that ends has. */
async function settled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

const bubble = (page: Page) =>
  page.locator("main [role=status][aria-live=polite]");

test.describe("resting gaze", () => {
  test("beside the step Pip rests turned toward it; centred on Welcome he faces the Learner", async ({
    page,
  }) => {
    await page.goto(STEP);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    await page.goto("/");
    await expect(pip(page)).toHaveAttribute("data-pip", "hero");
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", FORWARD);
  });

  test("under reduced motion Pip keeps his resting gaze, even when a command is copied", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(STEP);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    await page.getByRole("button", { name: /^Copy / }).click();
    await page.waitForTimeout(300);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
  });
});

test("Copy turns Pip's gaze to the command, and it comes back to rest", async ({
  page,
}) => {
  const seen = watch(page);
  await page.goto(STEP);
  await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
  // The look lasts 1.5 s, and under load click() can return after it has
  // ended, so the page records every gaze from before the click.
  await page.evaluate(() => {
    const el = document.querySelector("[data-pip]");
    const gazes: string[] = [];
    Object.assign(window, { gazes });
    if (el === null) return;
    new MutationObserver(() => {
      gazes.push(el.getAttribute("data-pip-gaze") ?? "");
    }).observe(el, { attributeFilter: ["data-pip-gaze"] });
  });
  await page.getByRole("button", { name: /^Copy / }).click();
  const looks = () =>
    page.evaluate(() =>
      (window as unknown as { gazes: string[] }).gazes.filter(
        (value) => value !== "0.40 0.00",
      ),
    );
  await expect.poll(looks).not.toHaveLength(0);
  // The command is below Pip and to his right.
  const [x = NaN, y = NaN] = ((await looks())[0] ?? "").split(" ").map(Number);
  expect(x).toBeGreaterThan(0);
  expect(y).toBeGreaterThan(0.3);
  await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST, {
    timeout: 10_000,
  });
  expect(seen.problems).toEqual([]);
});

test.describe("the help offer", () => {
  test("two Not yets in a row: the bubble offers the hint once, and its button opens it", async ({
    page,
  }) => {
    const seen = watch(page);
    await page.goto(STEP);
    await expect(pip(page)).toHaveAttribute("data-pip-rendering", "rig", {
      timeout: 20_000,
    });
    const said = await noteBubble(page);

    await send(page, notYet());
    await page.waitForTimeout(2_000);
    await expect(bubble(page)).not.toContainText(OFFER);
    await send(page, notYet());
    await expect(bubble(page)).toContainText(OFFER);
    // Pip turned to the Learner with Explaining, under the offer's own ID.
    await expect(pip(page)).toHaveAttribute("data-pip-reaction", /^help\./);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", FORWARD);
    await expect(page.locator("main [data-tone=offer]")).toBeVisible();

    await page.getByRole("button", { name: "Show the hint" }).click();
    const hint = page.locator("[data-pip-target=hint]");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Hint 1.");
    await expect(hint).toBeFocused();
    await expect(bubble(page)).not.toContainText(OFFER);

    // The live region said the offer once: one change into it, one out.
    const texts = await said();
    expect(texts.filter((text) => text.includes(OFFER))).toHaveLength(1);
    expect(seen.problems).toEqual([]);
  });

  test("dismissed, it ends for the step and never comes back there", async ({
    page,
  }) => {
    await page.goto(STEP);
    await send(page, notYet());
    await send(page, notYet());
    await expect(bubble(page)).toContainText(OFFER);
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(bubble(page)).not.toContainText(OFFER);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await send(page, notYet());
    await send(page, notYet());
    await page.waitForTimeout(2_500);
    await expect(bubble(page)).not.toContainText(OFFER);
    // The hint is still there for the asking.
    await expect(
      page.getByRole("button", { name: "Show a hint" }),
    ).toBeVisible();
  });

  test("while the Steps panel is open it waits, and the live region announces it once the panel closes", async ({
    page,
  }) => {
    await page.goto(STEP);
    // Every change to the bubble, with whether it was inert then.
    await page.evaluate(() => {
      const region = document.querySelector(
        "main [role=status][aria-live=polite]",
      );
      const changes: { text: string; inert: boolean }[] = [];
      Object.assign(window, { changes });
      if (region === null) return;
      new MutationObserver(() => {
        changes.push({
          text: region.textContent,
          inert: region.closest("[inert]") !== null,
        });
      }).observe(region, { subtree: true, childList: true });
    });
    await page.getByRole("button", { name: "Steps" }).click();
    const outline = page.getByRole("dialog", { name: "Steps" });
    await expect(outline).toBeVisible();
    await send(page, notYet());
    await send(page, notYet());
    await page.waitForTimeout(2_500);
    await expect(bubble(page)).not.toContainText(OFFER);
    await page.keyboard.press("Escape");
    await expect(outline).toBeHidden();
    await expect(bubble(page)).toContainText(OFFER);
    await expect(pip(page)).toHaveAttribute("data-pip-reaction", /^help\./);
    const changes = await page.evaluate(
      () =>
        (window as unknown as { changes: { text: string; inert: boolean }[] })
          .changes,
    );
    const offers = changes.filter((change) => change.text.includes(OFFER));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((change) => !change.inert)).toBe(true);
  });

  test("closing it never says the unchanged status again", async ({ page }) => {
    await page.goto(STEP);
    await send(page, notYet());
    await send(page, notYet());
    await expect(bubble(page)).toContainText(OFFER);
    // Every node put into the live region from now on.
    await page.evaluate(() => {
      const region = document.querySelector(
        "main [role=status][aria-live=polite]",
      );
      const added: string[] = [];
      Object.assign(window, { added });
      if (region === null) return;
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes)
            added.push(node.textContent ?? "");
      }).observe(region, { subtree: true, childList: true });
    });
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.locator("[data-help-offer]")).toHaveCount(0);
    await expect(bubble(page)).toHaveText("Watching your Practice copy.");
    const added = await page.evaluate(
      () => (window as unknown as { added: string[] }).added,
    );
    expect(added).toEqual([]);
  });

  test("it opens smoothly: the step card glides down and Pip stays put", async ({
    page,
  }) => {
    await page.goto(STEP);
    await settled(page);
    const card = page.locator("main article");
    const pipTop = (await pip(page).boundingBox())?.y;
    const before = (await card.boundingBox())?.y ?? NaN;
    // The card's top on every frame from the offer on, and Pip's.
    await page.evaluate(() => {
      const article = document.querySelector("main article");
      const drawn = document.querySelector("[data-pip]");
      const frames: { card: number; pip: number }[] = [];
      Object.assign(window, { frames });
      const sample = () => {
        frames.push({
          card: article?.getBoundingClientRect().y ?? NaN,
          pip: drawn?.getBoundingClientRect().y ?? NaN,
        });
        if (frames.length < 120) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await send(page, notYet());
    await send(page, notYet());
    await expect(bubble(page)).toContainText(OFFER);
    await page.waitForTimeout(1_000);
    const frames = await page.evaluate(
      () =>
        (window as unknown as { frames: { card: number; pip: number }[] })
          .frames,
    );
    const after = frames.at(-1)?.card ?? NaN;
    expect(after).toBeGreaterThan(before + 40);
    // Some frames caught the card on its way, between where it was and
    // where it ends.
    const between = frames.filter(
      (f) => f.card > before + 4 && f.card < after - 4,
    );
    expect(between.length).toBeGreaterThan(1);
    for (const f of frames) expect(f.pip).toBeCloseTo(pipTop ?? NaN, 0);
  });

  test("under reduced motion the offer still shows, with no turn", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(STEP);
    await send(page, notYet());
    await send(page, notYet());
    await expect(bubble(page)).toContainText(OFFER);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    await page.getByRole("button", { name: "Show the hint" }).click();
    await expect(page.locator("[data-pip-target=hint]")).toBeFocused();
  });
});

/** Whether two boxes share any area. */
function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** Pip's box overlaps no content on the screen, and sits inside the window. */
async function coversNothing(page: Page, content: Locator) {
  const box = await pip(page).boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  const width = page.viewportSize()?.width ?? 0;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  const boxes = await content.evaluateAll((els) =>
    els
      .filter((el) => el.closest("[data-pip]") === null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          what: `${el.tagName} ${el.textContent.slice(0, 30)}`,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      })
      .filter((r) => r.width > 0 && r.height > 0),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const other of boxes)
    expect(overlap(box, other), `Pip covers ${other.what}`).toBe(false);
}

test.describe("below the sm breakpoint, at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** Pip sits above the box, at its left, and the box keeps the full width. */
  async function above(page: Page, box: Locator) {
    const pipBox = await pip(page).boundingBox();
    const boxBox = await box.boundingBox();
    const mainBox = await page.locator("main").boundingBox();
    expect(pipBox && boxBox && mainBox).toBeTruthy();
    if (!pipBox || !boxBox || !mainBox) return;
    expect(pipBox.y + pipBox.height).toBeLessThanOrEqual(boxBox.y);
    expect(Math.abs(pipBox.x - boxBox.x)).toBeLessThan(1);
    // The box spans the column, as every box beside it does.
    const column = await page
      .locator("main > *")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(boxBox.width).toBeCloseTo(column, 0);
  }

  test("on the Learning journey Pip sits above the Next band, which keeps the full width", async ({
    page,
  }) => {
    await page.goto("/#/journey");
    await expect(pip(page)).toHaveAttribute("data-pip", "beside");
    await above(page, page.getByText("Next", { exact: true }).locator("../.."));
    await coversNothing(
      page,
      page.locator(
        "main h1, main p, main [role=tab], main [role=tabpanel], main li, main a, main b",
      ),
    );
  });

  test("on Progress Pip sits above the skills, which keep the full width", async ({
    page,
  }) => {
    await page.goto("/#/progress");
    await expect(pip(page)).toHaveAttribute("data-pip", "beside");
    await above(page, page.locator("section[aria-labelledby=progress-skills]"));
    await coversNothing(
      page,
      page.locator("main h1, main h2, main p, main li, main section, main a"),
    );
  });
});

for (const width of [720, 1440]) {
  test(`beside the step at ${String(width)} px Pip covers no code or instruction text, turned toward it`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(STEP);
    await expect(pip(page)).toHaveAttribute("data-pip", "beside");
    await expect(pip(page)).toHaveAttribute("data-pip-rendering", "rig", {
      timeout: 20_000,
    });
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    await settled(page);
    await coversNothing(
      page,
      page.locator(
        "main h1, main h2, main p, main li, main pre, main code, main button",
      ),
    );
  });

  test(`on the Learning journey Pip sits beside the Next band at ${String(width)} px, covering nothing, with no Greeting`, async ({
    page,
  }) => {
    const seen = watch(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/journey");
    await expect(pip(page)).toHaveAttribute("data-pip", "beside");
    await expect(pip(page)).toHaveAttribute("data-pip-rendering", "rig", {
      timeout: 20_000,
    });
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    const band = page.getByText("Next", { exact: true }).locator("../..");
    const pipBox = await pip(page).boundingBox();
    const bandBox = await band.boundingBox();
    expect(pipBox && bandBox).toBeTruthy();
    if (pipBox && bandBox) {
      // Beside it, to its left, and level with it.
      expect(pipBox.x + pipBox.width).toBeLessThanOrEqual(bandBox.x);
      expect(
        Math.abs(
          pipBox.y + pipBox.height / 2 - (bandBox.y + bandBox.height / 2),
        ),
      ).toBeLessThan(8);
    }
    await coversNothing(
      page,
      page.locator(
        "main h1, main p, main [role=tab], main [role=tabpanel], main li, main a, main b",
      ),
    );
    await page.waitForTimeout(500);
    await expect(pip(page)).not.toHaveAttribute("data-pip-reaction");
    expect(seen.problems).toEqual([]);
  });

  test(`on Progress Pip sits beside the skills at ${String(width)} px, covering nothing, glances toward the next goal, with no Greeting`, async ({
    page,
  }) => {
    const seen = watch(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/progress");
    await expect(pip(page)).toHaveAttribute("data-pip", "beside");
    // The glance: down toward the next goal, then back to rest.
    await expect.poll(() => gaze(page)).not.toEqual([0.4, 0]);
    const [, y] = await gaze(page);
    expect(y).toBeGreaterThan(0.3);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST, {
      timeout: 3_000,
    });
    const skills = page.locator("section[aria-labelledby=progress-skills]");
    const pipBox = await pip(page).boundingBox();
    const skillsBox = await skills.boundingBox();
    if (pipBox && skillsBox)
      expect(pipBox.x + pipBox.width).toBeLessThanOrEqual(skillsBox.x);
    await coversNothing(
      page,
      page.locator("main h1, main h2, main p, main li, main section, main a"),
    );
    await expect(pip(page)).toHaveAttribute("data-pip-rendering", "rig", {
      timeout: 20_000,
    });
    await expect(pip(page)).not.toHaveAttribute("data-pip-reaction");
    expect(seen.problems).toEqual([]);
  });
}
