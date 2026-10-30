// The design components as Chromium draws them, mounted from
// test/component-sheet.tsx on the dev server (the built app holds only the
// components its screens use): in a contrast theme each still shows its
// state, and a Switch's thumb snaps under reduced motion however it is set.
import { expect, test, type Page } from "@playwright/test";
import { DEV } from "../playwright.config.ts";

test.use({ baseURL: DEV });

const SHEET = "/test/component-sheet.tsx";

async function openSheet(page: Page) {
  await page.goto("/#/journey");
  await page.evaluate(async (url) => {
    const sheet = (await import(url)) as { mountSheet: () => void };
    sheet.mountSheet();
  }, SHEET);
  await expect(page.locator("[data-sheet] [role=switch]").first()).toBeVisible({
    timeout: 30_000,
  });
}

const style = (page: Page, selector: string, property: string) =>
  page
    .locator(`[data-sheet] ${selector}`)
    .first()
    .evaluate(
      (el, name) => getComputedStyle(el).getPropertyValue(name),
      property,
    );

// The browser's value for a system colour in the current theme.
const system = (page: Page, keyword: string) =>
  page.evaluate((color) => {
    const probe = document.createElement("span");
    probe.style.cssText = `forced-color-adjust: none; color: ${color}`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, keyword);

test.describe("in a contrast theme (forced colours)", () => {
  for (const scheme of ["dark", "light"] as const) {
    test(`each component still shows its state, ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: "active", colorScheme: scheme });
      await openSheet(page);
      const [ink, highlight, highlightInk] = [
        await system(page, "CanvasText"),
        await system(page, "Highlight"),
        await system(page, "HighlightText"),
      ];
      const off = '[role=switch][aria-checked="false"]';
      const on = '[role=switch][aria-checked="true"]';

      // A Switch: off, a text-coloured thumb in an outlined track; on, a
      // highlight track with its thumb in the highlight's text colour.
      expect(await style(page, `${off} [data-track]`, "border-top-color")).toBe(
        ink,
      );
      expect(await style(page, `${off} [data-track]`, "background-color")).toBe(
        "rgba(0, 0, 0, 0)",
      );
      expect(await style(page, `${off} [data-thumb]`, "background-color")).toBe(
        ink,
      );
      expect(await style(page, `${on} [data-track]`, "background-color")).toBe(
        highlight,
      );
      expect(await style(page, `${on} [data-thumb]`, "background-color")).toBe(
        highlightInk,
      );

      // Segmented: the chosen one in the highlight colour.
      expect(
        await style(page, "label[data-selected]", "background-color"),
      ).toBe(highlight);
      expect(await style(page, "label[data-selected]", "color")).toBe(
        highlightInk,
      );
      expect(
        await style(
          page,
          "label:not([data-selected]):has([type=radio])",
          "background-color",
        ),
      ).not.toBe(highlight);

      // Choice: the picked answer by a thicker edge, at the same size.
      const answer = (state: string) =>
        page
          .locator(`[data-sheet] label[data-state=${state}]`)
          .evaluate(
            (el) =>
              `${getComputedStyle(el).borderTopWidth} ${String(el.getBoundingClientRect().height)}`,
          );
      const [picked, idle] = [await answer("picked"), await answer("idle")];
      expect(picked.split(" ")[0]).toBe("3px");
      expect(idle.split(" ")[0]).toBe("1px");
      expect(picked.split(" ")[1]).toBe(idle.split(" ")[1]);

      // ProgressBar: an outlined track with a text-coloured fill.
      expect(await style(page, "[data-fill]", "background-color")).toBe(ink);
      expect(await style(page, "[role=progressbar]", "outline-style")).toBe(
        "solid",
      );
    });
  }
});

test.describe("a Switch's thumb", () => {
  for (const [motion, choice, snaps] of [
    ["no-preference", null, false],
    ["reduce", null, true],
    ["no-preference", "reduce", true],
    ["reduce", "full", false],
  ] as const) {
    test(`${snaps ? "snaps" : "slides"} (system ${motion}, switch ${choice ?? "unset"})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await openSheet(page);
      await page.evaluate((value) => {
        if (value === null) delete document.documentElement.dataset.motion;
        else document.documentElement.dataset.motion = value;
      }, choice);
      const thumb = page
        .getByRole("switch", { name: "Sound" })
        .locator("[data-thumb]");
      const transition = await thumb.evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.transitionProperty, s.transitionDuration];
      });
      expect(transition[0]).toBe(
        snaps ? "background-color" : "translate, background-color",
      );
      if (snaps) {
        expect(parseFloat(transition[1] ?? "")).toBeLessThanOrEqual(0.12);
        await page.getByRole("switch", { name: "Sound" }).click();
        // Already at its place on the next frame, never part way.
        const travel = await thumb.evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--switch-travel").trim(),
        );
        expect(
          await thumb.evaluate(
            (el) =>
              new Promise<string>((done) =>
                requestAnimationFrame(() => {
                  done(getComputedStyle(el).translate);
                }),
              ),
          ),
        ).toBe(travel);
      }
    });
  }
});
