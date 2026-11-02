// Terminal rules re-homed in the browser (254), on routed snapshots
// (live.ts): a pasted answer arrives whole as one typed answer (rehoming row
// 463), and the overview, journey, Step-down and complete screens settle
// after their entrance and keep no animation running (row 235).
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { actionsOf } from "./play.ts";
import {
  complete,
  fullCourse,
  overview,
  overviewAt,
  snapshotOf,
  stepDown,
  typeBeat,
} from "./snapshots.ts";

test.use({ manualStream: true, viewport: { width: 1280, height: 900 } });

test("a pasted answer arrives whole as one typed answer (row 463)", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const sent = actionsOf(page);
  await page.goto(`/#/lesson/${typeBeat.id}/step`);
  await connected(page, snapshotOf(typeBeat, { revision: 2 }));
  const box = page.locator("[data-step-card]").getByRole("textbox", {
    name: "Which command shows the session's cost?",
  });
  await page.evaluate(() => navigator.clipboard.writeText("/usage --all\n"));
  await box.focus();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(box).toHaveValue("/usage --all");
  expect(sent).toEqual([]);
  await box.press("Enter");
  await expect
    .poll(() => sent)
    .toEqual([{ type: "answer.type", text: "/usage --all" }]);
});

/** Running animations outside Pip, whose Idle is the rig's own (274). */
const runningOutsidePip = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return !(target instanceof Element && target.closest("[data-pip]"));
      })
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element
          ? `${target.tagName} ${target.getAttribute("class") ?? ""}`
          : "?";
      }),
  );

const SCREENS: readonly [string, string, unknown][] = [
  ["the overview", "/#/lesson/b-1", snapshotOf(overview, { welcomed: true })],
  [
    "the journey",
    "/#/journey",
    snapshotOf(overviewAt("b-4"), { welcomed: true, course: fullCourse }),
  ],
  ["a Step-down", "/#/lesson/b-1/step", snapshotOf(stepDown)],
  ["Lesson complete", "/#/lesson/b-1/complete", snapshotOf(complete)],
];

for (const [name, path, snapshot] of SCREENS)
  test(`${name} settles after its entrance and keeps no animation running (row 235)`, async ({
    page,
  }) => {
    await page.goto(path);
    await connected(page, snapshot);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (name === "a Step-down")
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Less help from here",
      );
    // The entrance and any one-shot end; nothing loops after them.
    await expect
      .poll(() => runningOutsidePip(page), { timeout: 5_000 })
      .toEqual([]);
    await page.waitForTimeout(1_000);
    expect(await runningOutsidePip(page)).toEqual([]);
  });
