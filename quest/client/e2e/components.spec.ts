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

      // Every unearned Badge, each size and a capstone's inner ring
      // included, keeps its dash in the contrast theme; earned ones stay drawn.
      const badges = await page
        .locator("[data-sheet] [data-badges] svg[aria-label]")
        .evaluateAll((svgs) =>
          svgs.map((svg) => {
            const box = svg.getBoundingClientRect();
            const rings = [...svg.querySelectorAll("[stroke-dasharray]")];
            return {
              name: svg.getAttribute("aria-label") ?? "",
              drawn:
                box.width > 0 &&
                getComputedStyle(svg).color !== "rgba(0, 0, 0, 0)",
              rings: rings.length,
              dashed: rings.every(
                (ring) => getComputedStyle(ring).strokeDasharray !== "none",
              ),
            };
          }),
        );
      expect(badges).toHaveLength(4 * 23 + 3);
      for (const badge of badges) {
        expect(badge.drawn, badge.name).toBe(true);
        const unearned = badge.name.endsWith(", not yet");
        expect(badge.rings > 0, badge.name).toBe(unearned);
        expect(badge.dashed, badge.name).toBe(true);
      }
    });
  }
});

test.describe("the Badges", () => {
  for (const scheme of ["dark", "light"] as const) {
    test(`reach 3:1 on the page and say "Not yet" until earned, ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openSheet(page);
      const rows = await page
        .locator(
          "[data-sheet] [data-badges] figure, [data-sheet] [data-badges] > svg",
        )
        .evaluateAll((badges) => {
          const rgb = (value: string) => {
            const parts = /rgba?\(([^)]+)\)/.exec(value)?.[1]?.split(/[ ,/]+/);
            if (parts === undefined) throw new Error(`not rgb: ${value}`);
            return parts.slice(0, 3).map(Number);
          };
          const luminance = (value: string) => {
            const [r = 0, g = 0, b = 0] = rgb(value).map((c) => {
              const v = c / 255;
              return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const page = luminance(
            getComputedStyle(document.body).backgroundColor,
          );
          return badges.map((badge) => {
            const svg =
              badge.tagName === "svg" ? badge : badge.querySelector("svg");
            if (svg === null) throw new Error("a figure with no svg");
            const mark = luminance(getComputedStyle(svg).color);
            const caption = badge.querySelector("figcaption");
            return {
              name: svg.getAttribute("aria-label") ?? "",
              ratio:
                (Math.max(mark, page) + 0.05) / (Math.min(mark, page) + 0.05),
              caption: caption === null ? null : caption.innerText,
              captionRatio: [...(caption?.querySelectorAll("*") ?? [])].map(
                (line) => {
                  const text = luminance(getComputedStyle(line).color);
                  return (
                    (Math.max(text, page) + 0.05) /
                    (Math.min(text, page) + 0.05)
                  );
                },
              ),
              visible:
                caption === null ||
                (caption.getBoundingClientRect().height > 0 &&
                  getComputedStyle(caption).visibility === "visible"),
            };
          });
        });
      expect(rows).toHaveLength(4 * 23 + 3);
      for (const row of rows) {
        expect(row.ratio, row.name).toBeGreaterThanOrEqual(3);
        expect(row.visible, row.name).toBe(true);
        // Captions are small text, so they need 4.5:1.
        for (const ratio of row.captionRatio)
          expect(ratio, row.name).toBeGreaterThanOrEqual(4.5);
        if (row.caption !== null)
          expect(row.caption.includes("Not yet"), row.name).toBe(
            row.name.endsWith(", not yet"),
          );
      }
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

// Moved from shell.spec.ts (221): no screen shows a Disclosure until 245.
test.describe("the disclosure", () => {
  test("a disclosure opens and closes from the keyboard", async ({ page }) => {
    await openSheet(page);
    const details = page.locator("[data-sheet] details");
    const summary = details.locator("summary");
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open");
  });

  for (const [motion, duration] of [
    ["no-preference", "0.22s"],
    ["reduce", "0s"],
  ] as const) {
    test(`a disclosure's chevron turns only with full motion (${motion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await openSheet(page);
      const chevron = page.locator("[data-sheet] summary svg");
      expect(
        await chevron.evaluate((el) => getComputedStyle(el).transitionDuration),
      ).toBe(duration);
      await page
        .locator("[data-sheet]")
        .getByText("What the check looks for")
        .click();
      if (motion === "reduce") {
        // Snapped: already at its new angle on the next frame, never part way.
        expect(
          await chevron.evaluate(
            (el) =>
              new Promise<string>((done) =>
                requestAnimationFrame(() => {
                  done(getComputedStyle(el).rotate);
                }),
              ),
          ),
        ).toBe("90deg");
      }
      await expect
        .poll(() => chevron.evaluate((el) => getComputedStyle(el).rotate))
        .toBe("90deg");
    });
  }
});
