import type { Page } from "@playwright/test";
import { expect, test } from "./live.ts";
import { watch } from "./watch.ts";

const SCREENS: readonly (readonly [path: string, heading: string])[] = [
  ["/", "Learn Claude Code by using it."],
  ["/#/journey", "Learning journey"],
  ["/#/lesson/b-1", "Install, sign in and look around"],
  ["/#/lesson/b-1/step", "First step"],
  ["/#/lesson/b-1/complete", "Install, sign in and look around"],
  ["/#/progress", "Progress"],
];

async function fontsSettled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

const css = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

test("every screen renders, asks no host but 127.0.0.1 and logs no error", async ({
  page,
}) => {
  const seen = watch(page);
  for (const [path, heading] of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await fontsSettled(page);
  }

  const urls = seen.requests;
  expect(urls.length).toBeGreaterThan(3);
  expect(
    urls.filter((url) => url.hostname !== "127.0.0.1").map(String),
  ).toEqual([]);
  expect(seen.problems).toEqual([]);
});

test("every class a screen renders has a rule in the built CSS", async ({
  page,
}) => {
  // A class built at runtime from parts never reaches Tailwind's scanner, so
  // it would render with no style at all.
  const missing = new Set<string>();
  for (const [path] of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "/#/lesson/b-1/step") {
      await page.getByRole("button", { name: "Steps" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    for (const name of await page.evaluate(() => {
      const styled = new Set<string>();
      const walk = (rules: CSSRuleList) => {
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule)
            for (const m of rule.selectorText.matchAll(/\.((?:\\.|[\w-])+)/g))
              styled.add((m[1] ?? "").replace(/\\(.)/g, "$1"));
          if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of document.styleSheets) walk(sheet.cssRules);
      // Marker classes that only other selectors read, and the state classes
      // React Router's NavLink adds (the app styles aria-current instead).
      const markers = /^(group|peer)(\/.+)?$|^(active|pending|transitioning)$/;
      return [...document.querySelectorAll("[class]")]
        .flatMap((el) => [...el.classList])
        .filter((name) => !markers.test(name) && !styled.has(name));
    }))
      missing.add(`${path}: ${name}`);
  }
  expect([...missing]).toEqual([]);
});

test("renders with both bundled fonts, fetching only their Latin files", async ({
  page,
}) => {
  const seen = watch(page);
  await page.goto("/#/lesson/b-1/step");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("npm run check -- b-1")).toBeVisible();
  await fontsSettled(page);

  // The browser's own record of the font faces it loaded.
  const loaded = await page.evaluate(() =>
    [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map(
        (face) =>
          `${face.family.replaceAll(/["']/g, "")} ${face.unicodeRange.split(",")[0] ?? ""}`,
      ),
  );
  // Only the Latin faces loaded (Chrome writes U+0000-00FF as U+0-FF).
  expect(loaded.sort()).toEqual([
    "Inter Variable U+0-FF",
    "JetBrains Mono Variable U+0-FF",
  ]);

  // The computed families, and the font each element's glyphs were drawn with.
  expect(await css(page, "h1", "font-family")).toMatch(/^"Inter Variable"/);
  expect(await css(page, "code", "font-family")).toMatch(
    /^"JetBrains Mono Variable"/,
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  // A web font's glyphs (isCustomFont) from the bundled files, with Inter
  // drawn through its optical-size axis.
  for (const [selector, family, instance] of [
    ["h1", "Inter", /^Inter-Regular_opsz/],
    ["code", "JetBrains Mono", /^JetBrainsMono-/],
  ] as const) {
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector,
    });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts, selector).toEqual([
      expect.objectContaining({
        familyName: family,
        isCustomFont: true,
        postScriptName: expect.stringMatching(instance),
      }),
    ]);
  }

  // Fonts come from the app's own files: the two Latin subsets and nothing else.
  const fontFiles = seen.requests.filter((url) =>
    url.pathname.endsWith(".woff2"),
  );
  expect(
    fontFiles.every(
      (url) =>
        url.hostname === "127.0.0.1" && url.pathname.startsWith("/assets/"),
    ),
  ).toBe(true);
  expect(
    fontFiles
      .map((url) =>
        url.pathname.replace(/-[\w-]{8}\.woff2$/, "").slice("/assets/".length),
      )
      .sort(),
  ).toEqual(["inter-latin-opsz-normal", "jetbrains-mono-latin-wght-normal"]);
});

test.describe("themes", () => {
  for (const [scheme, bg] of [
    ["dark", "rgb(11, 16, 32)"],
    ["light", "rgb(251, 246, 239)"],
  ] as const) {
    test(`follow the system's ${scheme} setting`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/#/journey");
      await expect.poll(() => css(page, "body", "background-color")).toBe(bg);
      expect(await css(page, ":root", "color-scheme")).toBe(scheme);
    });
  }

  test("a picked theme overrides the system setting", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/#/journey");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await expect
      .poll(() => css(page, "body", "background-color"))
      .toBe("rgb(11, 16, 32)");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light");
    });
    await expect
      .poll(() => css(page, "body", "background-color"))
      .toBe("rgb(251, 246, 239)");
  });
});

test.describe("states from tokens", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({
      colorScheme: "dark",
      reducedMotion: "no-preference",
    });
    await page.goto("/");
    await fontsSettled(page);
  });

  test("hover and pressed change the primary button's fill, and pressing nudges it", async ({
    page,
  }) => {
    const start = page.getByRole("link", { name: "Start the first lesson" });
    const fill = () =>
      start.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await fill()).toBe("rgb(255, 120, 78)");

    await start.hover();
    await expect.poll(fill).toBe("rgb(255, 159, 115)");

    await page.mouse.down();
    await expect.poll(fill).not.toBe("rgb(255, 159, 115)");
    await expect
      .poll(() => start.evaluate((el) => getComputedStyle(el).translate))
      .toBe("0px 1px");
    await expect
      .poll(() => start.evaluate((el) => getComputedStyle(el).scale))
      .toBe("0.985");
  });

  test("keyboard focus draws the focus ring", async ({ page }) => {
    const start = page.getByRole("link", { name: "Start the first lesson" });
    await page.keyboard.press("Tab");
    await expect(start).toBeFocused();
    const ring = await start.evaluate((el) => {
      const style = getComputedStyle(el);
      return [
        style.outlineStyle,
        style.outlineWidth,
        style.outlineColor,
        style.outlineOffset,
      ];
    });
    expect(ring).toEqual(["solid", "2px", "rgb(255, 120, 78)", "2px"]);
  });
});

test.describe("motion", () => {
  test("full motion: screens rise 8 px over 360 ms", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/#/journey");
    expect((await css(page, ":root", "--rise")).trim()).toBe("8px");
    expect(await css(page, "[data-screen]", "animation-duration")).toBe(
      "0.36s",
    );
  });

  test("reduced motion: no travel, and fades of at most 120 ms", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect((await css(page, ":root", "--rise")).trim()).toBe("0px");
    expect(await css(page, "[data-screen]", "animation-duration")).toBe(
      "0.12s",
    );

    const start = page.getByRole("link", { name: "Start the first lesson" });
    await start.hover();
    await page.mouse.down();
    await expect
      .poll(() => start.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe("rgb(255, 159, 115)");
    expect(await start.evaluate((el) => getComputedStyle(el).translate)).toBe(
      "0px",
    );
    expect(await start.evaluate((el) => getComputedStyle(el).scale)).toBe("1");
  });

  for (const [motion, duration] of [
    ["no-preference", "0.22s"],
    ["reduce", "0s"],
  ] as const) {
    test(`a disclosure's chevron turns only with full motion (${motion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.goto("/#/lesson/b-1");
      const chevron = page.locator("summary svg");
      expect(
        await chevron.evaluate((el) => getComputedStyle(el).transitionDuration),
      ).toBe(duration);
      await page.getByText("What the check looks for").click();
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

  test("the Settings choice of full motion overrides the system's reduce", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#/journey");
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-motion", "full");
    });
    expect((await css(page, ":root", "--rise")).trim()).toBe("8px");
  });
});

test("the action bar is fixed to the window through a portal, outside the animated screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/#/lesson/b-1/step");
  const bar = page.locator("[data-action-bar]");
  await expect(bar).toBeVisible();
  expect(await bar.evaluate((el) => el.parentElement === document.body)).toBe(
    true,
  );

  await page.mouse.wheel(0, 2000);
  await expect
    .poll(async () => {
      const box = await bar.boundingBox();
      return box ? Math.round(box.y + box.height) : -1;
    })
    .toBe(600);
  await expect(bar.getByRole("link", { name: "Next step" })).toBeInViewport();
});

test.describe("secondary buttons", () => {
  for (const [scheme, line2] of [
    ["dark", "rgb(58, 70, 114)"],
    ["light", "rgb(201, 184, 161)"],
  ] as const) {
    test(`draw their line-2 edge at rest and coral on hover, ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/#/lesson/b-1/step");
      const check = page.getByRole("button", { name: "Check again" });
      const edge = () =>
        check.evaluate((el) => {
          const style = getComputedStyle(el);
          return `${style.borderTopWidth} ${style.borderTopColor}`;
        });
      await expect.poll(edge).toBe(`1px ${line2}`);
      await check.hover();
      await expect.poll(edge).toBe("1px rgb(255, 120, 78)");
    });
  }
});

test("the bars span the window, and the action bar lines up with the lesson column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/lesson/b-1/step");
  const layout = await page.evaluate(() => {
    const box = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`no ${selector}`);
      return el.getBoundingClientRect();
    };
    const buttons = [
      ...document.querySelectorAll(
        "[data-action-bar] a, [data-action-bar] button",
      ),
    ].map((el) => el.getBoundingClientRect());
    return {
      scrolls: document.documentElement.scrollHeight > window.innerHeight,
      width: window.innerWidth,
      header: box("header").right,
      bar: box("[data-action-bar]").right,
      card: [box("main article").left, box("main article").right],
      ends: [buttons[0]?.left, buttons.at(-1)?.right],
    };
  });
  // A page that does not scroll keeps no scrollbar gutter beside the bars.
  expect(layout.scrolls).toBe(false);
  expect(layout.header).toBe(layout.width);
  expect(layout.bar).toBe(layout.width);
  expect(layout.ends[0]).toBeCloseTo(layout.card[0] ?? 0, 0);
  expect(layout.ends[1]).toBeCloseTo(layout.card[1] ?? 0, 0);
});

test("an open Panel holds the page still and keeps focus out of the action bar", async ({
  page,
}) => {
  // Short enough to scroll, so the window shows a scrollbar.
  await page.setViewportSize({ width: 1000, height: 480 });
  await page.goto("/#/lesson/b-1/step");
  const measure = () =>
    page.evaluate(() => ({
      column: document.querySelector("main")?.getBoundingClientRect().left,
      bar: document.querySelector("[data-action-bar]")?.getBoundingClientRect()
        .right,
    }));
  const before = await measure();

  await page.getByRole("button", { name: "Steps" }).click();
  const dialog = page.getByRole("dialog", { name: "Steps" });
  await expect(dialog).toBeVisible();
  expect(await measure()).toEqual(before);
  expect(
    await page.evaluate(() => {
      const scrim = document.querySelector("[data-panel-scrim]");
      return scrim?.getBoundingClientRect().width === window.innerWidth;
    }),
  ).toBe(true);

  const bar = page.locator("[data-action-bar]");
  expect(await bar.evaluate((el) => el.closest("[inert]") !== null)).toBe(true);
  // Focus that comes back from outside the page (here, from no element at
  // all) reaches the dialog and never the page behind it; body stands for the
  // browser's own controls.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  const reached = new Set<string>();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    reached.add(
      await page.evaluate(() => {
        const at = document.activeElement;
        if (!at || at === document.body) return "browser";
        return at.closest("[role=dialog]") ? "dialog" : "page";
      }),
    );
  }
  expect(reached).toContain("dialog");
  expect(reached).not.toContain("page");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await bar.evaluate((el) => el.closest("[inert]") === null)).toBe(true);
  expect(await measure()).toEqual(before);
});

test("a command wraps at phone width only between its arguments", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/#/lesson/b-1/step");
  await fontsSettled(page);
  const code = page.locator("main code");
  await expect(code).toHaveText("npm run check -- b-1");
  const args = await code.evaluate((el) => {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    return [...el.children].map((arg) => ({
      text: arg.textContent,
      oneLine: arg.getBoundingClientRect().height < lineHeight * 1.5,
    }));
  });
  expect(args.map((a) => a.text)).toEqual(["npm", "run", "check", "--", "b-1"]);
  expect(args.every((a) => a.oneLine)).toBe(true);
});

test.describe("lesson nodes on the journey", () => {
  for (const [motion, scale] of [
    ["no-preference", "1.06"],
    ["reduce", "1"],
  ] as const) {
    test(`grow on hover only with full motion (${motion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.goto("/#/journey");
      const node = page.getByRole("link", { name: /^Lesson 2\b/ });
      await node.hover();
      await expect
        .poll(() => node.evaluate((el) => getComputedStyle(el).scale))
        .toBe(scale);
    });
  }
});

test.describe("the Learning journey's layout", () => {
  for (const width of [1440, 1024]) {
    test(`every lesson title starts on one line under its node, at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#/journey");
      await fontsSettled(page);
      const offsets = await page
        .locator("[role=tabpanel] li")
        .evaluateAll((items) =>
          items.map((li) => {
            const node = li.querySelector("a")?.getBoundingClientRect();
            const label = li.querySelector("span")?.getBoundingClientRect();
            return node && label ? Math.round(label.top - node.top) : -1;
          }),
        );
      expect(offsets.length).toBeGreaterThan(1);
      expect(new Set(offsets).size).toBe(1);
    });
  }

  for (const width of [360, 390, 820, 1023]) {
    test(`below lg every Level's Lessons stack down the track, all in view, at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#/journey");
      await fontsSettled(page);
      for (const level of ["Beginner", "Intermediate", "Advanced"]) {
        await page.getByRole("tab", { name: new RegExp(`^${level}`) }).click();
        const layout = await page
          .locator("[role=tabpanel]")
          .evaluate((panel) => {
            const box = panel.getBoundingClientRect();
            return {
              sideways: panel.scrollWidth - panel.clientWidth,
              panel: [box.left, box.right],
              rows: [...panel.querySelectorAll("li")].map((li) => {
                const node = li.querySelector("a")?.getBoundingClientRect();
                const label = li.querySelector("span")?.getBoundingClientRect();
                if (!node || !label) throw new Error("a lesson without a node");
                return {
                  node: [node.left, node.right, node.top, node.bottom],
                  label: [label.left, label.right, label.top],
                };
              }),
            };
          });
        expect(layout.sideways, level).toBe(0);
        expect(layout.rows.length, level).toBeGreaterThan(5);
        const [left = 0, right = 0] = layout.panel;
        let above = -Infinity;
        for (const { node, label } of layout.rows) {
          const [nodeLeft = 0, nodeRight = 0, nodeTop = 0, nodeBottom = 0] =
            node;
          const [labelLeft = 0, labelRight = 0, labelTop = 0] = label;
          // One column: every node at the same left, each below the last.
          expect(nodeLeft).toBe(layout.rows[0]?.node[0]);
          expect(nodeTop).toBeGreaterThan(above);
          above = nodeBottom;
          // The title beside its node, starting within the node's height, and all of it inside the panel.
          expect(labelLeft).toBeGreaterThan(nodeRight);
          expect(labelTop).toBeLessThan(nodeBottom);
          expect(nodeLeft).toBeGreaterThanOrEqual(left);
          expect(labelRight).toBeLessThanOrEqual(right);
        }
      }
    });
  }

  for (const [width, orientation, key] of [
    [1440, "horizontal", "ArrowRight"],
    [390, "vertical", "ArrowDown"],
  ] as const) {
    test(`Level tabs read as ${orientation} at ${String(width)} px and follow ${key}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/#/journey");
      const tablist = page.getByRole("tablist", { name: "Levels" });
      await expect(tablist).toHaveAttribute("aria-orientation", orientation);
      await page.getByRole("tab", { name: /^Beginner/ }).focus();
      await page.keyboard.press(key);
      await expect(
        page.getByRole("tab", { name: /^Intermediate/ }),
      ).toBeFocused();
    });
  }

  test("the tabs' orientation follows the window as it narrows", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto("/#/journey");
    const tablist = page.getByRole("tablist", { name: "Levels" });
    await expect(tablist).toHaveAttribute("aria-orientation", "horizontal");
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(tablist).toHaveAttribute("aria-orientation", "vertical");
  });
});

test.describe("the reading sheet", () => {
  for (const [width, expected] of [
    [1440, 760],
    [390, 390],
  ] as const) {
    test(`is ${String(expected)} px wide in a ${String(width)} px window`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#/lesson/b-3");
      await page.getByRole("button", { name: "Read the full lesson" }).click();
      const dialog = page.getByRole("dialog", { name: "Read the full lesson" });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(Math.round(box?.width ?? 0)).toBe(expected);
    });
  }
});

test("landmarks: the step's actions are a named region, and the page has no stray footer", async ({
  page,
}) => {
  await page.goto("/#/lesson/b-1/step");
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  const actions = page.getByRole("region", { name: "Step actions" });
  await expect(
    actions.getByRole("button", { name: "Check again" }),
  ).toBeVisible();
  await page.goto("/#/lesson/b-1");
  await expect(
    page
      .getByRole("navigation", { name: "Where you are" })
      .getByRole("link", { name: "Lesson 1" }),
  ).toHaveAttribute("aria-current", "page");
});

test.describe("the top bar in a Lesson", () => {
  for (const width of [360, 390, 480, 600, 720, 768, 800, 840, 1024, 1280]) {
    test(`keeps the lesson cluster centred, clear of the brand and the main nav, at ${String(width)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto("/#/lesson/b-1/step");
      await fontsSettled(page);
      const bar = await page
        .locator("header")
        .first()
        .evaluate((header) => {
          const style = getComputedStyle(header);
          const box = header.getBoundingClientRect();
          const [brand, where, main] = [...header.children]
            .slice(0, 3)
            .map((el) => el.getBoundingClientRect());
          if (!brand || !where || !main) throw new Error("no top bar columns");
          return {
            centre:
              (box.left +
                parseFloat(style.paddingLeft) +
                box.right -
                parseFloat(style.paddingRight)) /
              2,
            where: (where.left + where.right) / 2,
            gaps: [where.left - brand.right, main.left - where.right],
          };
        });
      expect(Math.abs(bar.where - bar.centre)).toBeLessThanOrEqual(1);
      for (const gap of bar.gaps) expect(gap).toBeGreaterThanOrEqual(24);
    });
  }
});

test.describe("keyboard focus is never hidden behind the fixed bars", () => {
  for (const [width, height] of [
    [844, 390],
    [1280, 450],
    [390, 470],
  ] as const) {
    test(`the focused Copy button stays in view at ${String(width)}x${String(height)}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/#/lesson/b-1/step");
      await fontsSettled(page);
      await page.getByRole("button", { name: "Settings" }).focus();
      await page.keyboard.press("Tab");
      const copy = page.getByRole("button", { name: /^Copy/ });
      await expect(copy).toBeFocused();
      const seen = await copy.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const bar = document
          .querySelector("[data-action-bar]")
          ?.getBoundingClientRect();
        const atCentre = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return {
          shown: atCentre !== null && el.contains(atCentre),
          clear: bar !== undefined && box.bottom <= bar.top,
        };
      });
      expect(seen).toEqual({ shown: true, clear: true });
    });
  }
});

test("a Panel whose body overflows lets the keyboard reach and scroll it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/#/lesson/b-1");
  await page.getByRole("button", { name: "Read the full lesson" }).click();
  const dialog = page.getByRole("dialog", { name: "Read the full lesson" });
  await expect(dialog).toBeVisible();
  const body = dialog.getByRole("region", { name: "Read the full lesson" });
  // A body that fits is no tab stop.
  await expect(body).toHaveCount(0);

  // A long page, as the rendered lesson will be.
  await dialog.evaluate((el) => {
    const content = el.querySelector(":scope > div");
    for (let i = 0; i < 80; i++) {
      const line = document.createElement("p");
      line.textContent = `Line ${String(i + 1)}`;
      content?.append(line);
    }
  });
  await expect(body).toHaveCount(1);

  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(body).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(body).toBeFocused();

  await page.keyboard.press("PageDown");
  await expect
    .poll(() => body.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("End");
  await expect
    .poll(() =>
      body.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop),
    )
    .toBeLessThanOrEqual(1);
});

test.describe("in a contrast theme (forced colours)", () => {
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

  for (const scheme of ["dark", "light"] as const) {
    test(`step dots keep their states, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ forcedColors: "active", colorScheme: scheme });
      await page.goto("/#/lesson/b-1/step");
      const dots = page.locator("ol[aria-label=Steps] li");
      // The workspace starts at the first step; show the second one as done.
      await dots.nth(1).evaluate((li) => {
        li.setAttribute("data-state", "done");
      });
      const look = (i: number) =>
        dots.nth(i).evaluate((li) => {
          const style = getComputedStyle(li);
          return `${style.backgroundColor} ${style.borderTopWidth} ${style.borderTopColor}`;
        });
      const [ink, highlight] = [
        await system(page, "CanvasText"),
        await system(page, "Highlight"),
      ];
      // The dot just marked done eases into its fill.
      await expect.poll(() => look(0)).toBe(`${highlight} 1px ${highlight}`);
      await expect.poll(() => look(1)).toBe(`${ink} 1px ${ink}`);
      await expect.poll(() => look(2)).toBe(`rgba(0, 0, 0, 0) 1px ${ink}`);
    });
  }

  test("the selected Level card and the current Lesson stand out", async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/#/journey");
    const edges = await page
      .getByRole("tab")
      .evaluateAll((tabs) =>
        tabs.map(
          (tab) =>
            `${tab.getAttribute("aria-selected") ?? ""} ${getComputedStyle(tab).borderTopWidth} ${String(tab.getBoundingClientRect().height)}`,
        ),
      );
    const height = edges[0]?.split(" ")[2] ?? "";
    expect(edges).toEqual([
      `true 3px ${height}`,
      `false 1px ${height}`,
      `false 1px ${height}`,
    ]);

    const fill = (name: RegExp) =>
      page
        .getByRole("link", { name })
        .evaluate((a) => getComputedStyle(a).backgroundColor);
    expect(await fill(/, current$/)).toBe(await system(page, "Highlight"));
    expect(await fill(/^Lesson 2\b/)).toBe(await system(page, "Canvas"));
  });
});
