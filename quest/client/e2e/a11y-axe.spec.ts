// axe on every screen, panel and notice (255), in the light and dark themes
// by the system setting and by the Settings choice, failing on any serious
// or critical finding; lower ones are attached to the report.
import { test } from "./live.ts";
import { NOTICES, PANELS, SCREENS } from "./a11y-screens.ts";
import { THEMES, expectNoSeriousViolations, settle, useTheme } from "./a11y.ts";
import { snapshotOf, watching } from "./snapshots.ts";
import { connected, expect } from "./live.ts";

test.use({ manualStream: true, viewport: { width: 1280, height: 800 } });

for (const scheme of THEMES)
  test.describe(`${scheme} theme`, () => {
    for (const row of [...SCREENS, ...PANELS, ...NOTICES])
      test(`${row.name} has no serious or critical finding`, async ({
        page,
        context,
      }, testInfo) => {
        if (row.slow) test.setTimeout(60_000);
        await useTheme(page, scheme);
        await row.open(page, context);
        await settle(page);
        await expectNoSeriousViolations(page, testInfo, row.name);
      });

    test(`the ${scheme} theme chosen in Settings, over the other system theme`, async ({
      page,
      context,
    }, testInfo) => {
      await context.addInitScript((theme) => {
        localStorage.setItem("quest.theme", theme);
      }, scheme);
      await useTheme(page, scheme === "light" ? "dark" : "light");
      await page.goto("/#/lesson/b-1/step");
      await connected(page, snapshotOf(watching));
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(
        page.getByRole("dialog", { name: "Settings" }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      await settle(page);
      await expectNoSeriousViolations(page, testInfo, "Settings");
    });
  });

test.describe("at 375 px", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  // Reflow (WCAG 1.4.10), which no axe rule checks: a long Elective title
  // wraps instead of widening the page.
  test("Journey with Electives open fits the page width", async ({
    page,
    context,
  }) => {
    const row = SCREENS.find((r) => r.name === "Journey with Electives open");
    if (!row) throw new Error("no Journey with Electives open row");
    await row.open(page, context);
    await settle(page);
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
});
