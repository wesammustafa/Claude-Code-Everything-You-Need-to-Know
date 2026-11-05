// The Lesson overview walk (ticket 245): every one of the 23 overviews,
// frozen from the compiled course in overviews.ts, renders with no missing
// field and with its page's Stamp word for word (328); the folder
// question's slot holds the start back; and starting over asks first, where
// declining keeps the place.
import type { Page } from "@playwright/test";
import type { QuestAction } from "@quest/contract";
import { connected, expect, test } from "./live.ts";
import { i1Asking, overviews, walkCourse } from "./overviews.ts";
import { snapshotOf } from "./snapshots.ts";

test.use({ manualStream: true });

const summaryOf = (id: string) =>
  walkCourse.levels
    .flatMap((level) => level.lessons)
    .find((lesson) => lesson.id === id);

/** Opens Lesson `lesson`'s overview, its console errors collected. */
async function openOverview(page: Page, lesson: (typeof overviews)[number]) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/#/lesson/${lesson.id}`);
  await connected(
    page,
    snapshotOf(lesson, { welcomed: true, course: walkCourse }),
  );
  return errors;
}

for (const lesson of overviews)
  test(`${lesson.id}'s overview renders every field`, async ({ page }) => {
    const errors = await openOverview(page, lesson);
    const main = page.locator("main");
    const summary = summaryOf(lesson.id);
    expect(summary).toBeDefined();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      lesson.title.replaceAll("`", ""),
    );
    await expect(
      main.getByText(summary?.minutes ?? "", { exact: true }),
    ).toBeVisible();
    await expect(main.locator("[data-overview-stamp]")).toHaveText(
      summary?.stamp ?? "",
    );
    await expect(
      main.getByRole("img", { name: `${summary?.badge ?? ""}, not yet` }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "What you will do" }).locator("li"),
    ).toHaveCount(lesson.intro?.can.length ?? 0);
    expect(
      await page
        .getByRole("region", { name: "Help by part" })
        .locator("li")
        .count(),
    ).toBeGreaterThan(0);
    const check = main.locator("details");
    if (lesson.check.length === 0) await expect(check).toHaveCount(0);
    else {
      await main.getByText("What the check looks for").click();
      await expect(check.locator("[data-check-items] li")).toHaveCount(
        lesson.check.length,
      );
    }
    // Before the host answers, each You need line is still looked for.
    const needs = page.getByRole("region", { name: "What you need" });
    if (lesson.needs.length === 0) await expect(needs).toHaveCount(0);
    else
      await expect(needs.getByText("Looking on your PATH...")).toHaveCount(
        lesson.needs.length,
      );
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Read the full lesson" }),
    ).toBeVisible();
    const text = await page.locator("[data-screen]").innerText();
    expect(text).not.toMatch(/\bundefined\b|\bnull\b/);
    expect(errors).toEqual([]);
  });

test("with the folder question open, its slot shows and Start waits", async ({
  page,
}) => {
  await page.goto("/#/lesson/i-1");
  await connected(
    page,
    snapshotOf(i1Asking, { welcomed: true, course: walkCourse }),
  );
  await expect(page.locator("[data-folder-question]")).toBeAttached();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start/ })).toHaveCount(0);
});

test.describe("starting over asks first", () => {
  const found = overviews.find((lesson) => lesson.id === "b-1");
  if (!found) throw new Error("no b-1 overview");
  const b1 = found;
  const resumable = { ...b1, resumable: true };

  /** The overview with a saved place, every posted action recorded. */
  async function openResumable(page: Page) {
    const posts: QuestAction[] = [];
    await page.route("**/api/actions", (route) => {
      const { action, revision } = route.request().postDataJSON() as {
        action: QuestAction;
        revision: number;
      };
      posts.push(action);
      // The engine's answer: the overview from its first step, no place kept.
      const answer = snapshotOf(b1, {
        revision: revision + 1,
        welcomed: true,
        course: walkCourse,
      });
      return route.fulfill({
        json: { revision: answer.revision, snapshot: answer },
      });
    });
    await page.goto("/#/lesson/b-1");
    await connected(
      page,
      snapshotOf(resumable, { welcomed: true, course: walkCourse }),
    );
    await page.getByRole("button", { name: "Start over" }).click();
    return posts;
  }

  test("declining keeps the place and sends nothing", async ({ page }) => {
    const posts = await openResumable(page);
    const ask = page.getByRole("group", { name: "Start over" });
    await expect(ask).toContainText("Start this lesson over?");
    await expect(
      ask.getByRole("button", { name: "Keep my place" }),
    ).toBeFocused();
    await ask.getByRole("button", { name: "Keep my place" }).click();
    await expect(ask).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
    expect(posts).toEqual([]);
  });

  test("confirming sends lesson.restart, and the place goes", async ({
    page,
  }) => {
    const posts = await openResumable(page);
    await page
      .getByRole("group", { name: "Start over" })
      .getByRole("button", { name: "Start over" })
      .click();
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume" })).toHaveCount(0);
    expect(posts).toEqual([{ type: "lesson.restart", lesson: "b-1" }]);
  });
});
