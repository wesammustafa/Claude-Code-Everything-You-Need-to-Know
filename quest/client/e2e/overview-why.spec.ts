// Rows 71 and 795 (ticket 254, lane S1): every one of the 23 overviews
// opens with its Why line, `intro.why` in the page's words, and at 720 px
// that line is no taller than 2 line-heights.
import { connected, expect, test } from "./live.ts";
import { overviews, walkCourse } from "./overviews.ts";
import { snapshotOf } from "./snapshots.ts";

test.use({ manualStream: true, viewport: { width: 720, height: 900 } });

for (const lesson of overviews)
  test(`${lesson.id}'s overview shows its Why line in at most 2 lines at 720 px`, async ({
    page,
  }) => {
    await page.goto(`/#/lesson/${lesson.id}`);
    await connected(
      page,
      snapshotOf(lesson, { welcomed: true, course: walkCourse }),
    );
    const why = page.locator("[data-overview-why]");
    const words = lesson.intro?.why ?? null;
    expect(words).not.toBeNull();
    await expect(why).toBeVisible();
    const shown = (await why.innerText()).replace(/\s+/g, " ").trim();
    expect(shown).toBe(
      `Why: ${(words ?? "").replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}`,
    );
    const { height, line } = await why.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      line: parseFloat(getComputedStyle(element).lineHeight),
    }));
    expect(line).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(2 * line + 1);
  });
