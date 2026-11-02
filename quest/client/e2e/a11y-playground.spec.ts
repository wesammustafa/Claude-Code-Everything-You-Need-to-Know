// axe on the Pip Playground (255), on the dev server that alone serves it,
// in both themes; playground.spec.ts walks its Tab stops.
import { expect, test } from "@playwright/test";
import { DEV } from "../playwright.config.ts";
import { THEMES, expectNoSeriousViolations, settle, useTheme } from "./a11y.ts";

test.use({ baseURL: DEV, viewport: { width: 1280, height: 800 } });

for (const scheme of THEMES)
  test(`the Pip Playground in the ${scheme} theme has no serious or critical finding`, async ({
    page,
  }, testInfo) => {
    await useTheme(page, scheme);
    await page.goto("/#/playground");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pip Playground" }),
    ).toBeVisible({ timeout: 30_000 });
    await settle(page);
    await expectNoSeriousViolations(page, testInfo, "Pip Playground");
  });
