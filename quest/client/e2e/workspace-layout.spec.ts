// The Lesson workspace's layout (246, AC3): at 720 px and at full width the
// action bar never covers the step card's last line, with Back, Skip and a
// long done-label on the bar. Also the Tear down eyebrow and its first line,
// Back's description and Skip's when line, on routed snapshots.
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { KEY_NAMES } from "./play.ts";
import { course, offersBoth, snapshotOf, tearDown } from "./snapshots.ts";

test.use({ manualStream: true });

async function openAt(page: Page, snapshot: ReturnType<typeof snapshotOf>) {
  await page.goto("/#/lesson/b-1/step");
  await connected(page, snapshot);
  await expect(page.locator("[data-step-card]")).toBeVisible();
}

for (const width of [720, 1440]) {
  test(`at ${String(width)} px the action bar never covers the card's last line`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 640 });
    await openAt(page, snapshotOf(offersBoth));
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip" })).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "I've read the settings page and tried it",
      }),
    ).toBeVisible();
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    const seen = await page.evaluate(() => {
      const card = document.querySelector("[data-step-card]");
      const last = card?.lastElementChild?.getBoundingClientRect();
      const offers = document
        .querySelector("[data-offers]")
        ?.getBoundingClientRect();
      const bar = document
        .querySelector("[data-action-bar]")
        ?.getBoundingClientRect();
      return {
        card: last !== undefined && bar !== undefined && last.bottom <= bar.top,
        offers:
          offers !== undefined && bar !== undefined && offers.bottom <= bar.top,
        overflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      };
    });
    expect(seen).toEqual({ card: true, offers: true, overflow: false });
  });
}

test("Back and Skip are described by the lines that say why", async ({
  page,
}) => {
  await openAt(page, snapshotOf(offersBoth));
  await expect(
    page.getByRole("button", { name: "Back" }),
  ).toHaveAccessibleDescription(
    "Back to Read the cited lines: Reopen the cited source line and compare the claim with it.",
  );
  await expect(
    page.getByRole("button", { name: "Skip" }),
  ).toHaveAccessibleDescription("Skip it if you have no second machine.");
});

test("a Tear down step names its place, and the first says why", async ({
  page,
}) => {
  const view = {
    ...course,
    levels: course.levels.map((level) => ({
      ...level,
      lessons: level.lessons.map((lesson) =>
        lesson.id === "b-1" ? { ...lesson, tearDownLeft: true } : lesson,
      ),
    })),
  };
  await openAt(page, snapshotOf(tearDown, { course: view }));
  await expect(page.getByText(/Tear down, step 1 of 2$/)).toBeVisible();
  await expect(page.locator("[data-tear-down]")).toHaveText(
    "The Check passed. These steps put things back as they were.",
  );
});

test("no text on the workspace names a key", async ({ page }) => {
  for (const snapshot of [snapshotOf(offersBoth), snapshotOf(tearDown)]) {
    await openAt(page, snapshot);
    const text = await page.evaluate(() =>
      [
        document.querySelector("[data-screen]"),
        document.querySelector("[data-action-bar]"),
      ]
        .map((root) => (root as HTMLElement | null)?.innerText ?? "")
        .join("\n"),
    );
    expect(text).not.toMatch(KEY_NAMES);
  }
});
