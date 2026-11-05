// The page panel (244): a rendered Guide page fetched when opened, in both
// themes, with its links each going to the right place; Pip resting beside
// it; the Electives on the Level cards and the skills card's hand-over.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { PAGES_DIR, pageIndex, servePages } from "./pages.ts";
import {
  cardEntries,
  fullCourse,
  indexWarmupI1,
  overviewAt,
  playingB3,
  snapshotOf,
  warmupB2,
  watching,
} from "./snapshots.ts";

const GUIDE = "https://github.com/wesammustafa/Claude-Code-Quest";
const MCP = "Connect a tool with MCP";

const titleOf = (path: string) =>
  pageIndex.pages.find((p) => p.path === path)?.title ?? path;

test.use({ manualStream: true });

/** Opens `route` with the whole course and `lesson` as the active Lesson. */
async function openAt(
  page: Page,
  route: string,
  lesson: Parameters<typeof snapshotOf>[0],
  learnerCard = false,
) {
  await page.goto(route);
  const data = snapshotOf(lesson, { welcomed: true, course: fullCourse });
  await connected(
    page,
    learnerCard
      ? { ...data, learner: { ...data.learner, card: cardEntries } }
      : data,
  );
}

const readButton = (page: Page) =>
  page.getByRole("button", { name: "Read the full lesson" });

test("no page is fetched until one is opened, then the index and that page", async ({
  page,
  context,
}) => {
  const asked = await servePages(context);
  await openAt(page, "/#/lesson/i-7", overviewAt("i-7"));
  await expect(readButton(page)).toBeVisible();
  await page.goto("/#/journey");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning journey",
  );
  expect(asked).toEqual([]);
  await page.goto("/#/lesson/i-7");
  await readButton(page).click();
  await expect(page.getByRole("dialog", { name: MCP })).toBeVisible();
  expect(asked.slice(0, 2)).toEqual([
    "/pages/index.json",
    "/pages/intermediate/07-mcp.html",
  ]);
});

test.describe("a page with a diagram and callouts, and heading links", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`renders in the ${scheme} theme`, async ({ page, context }) => {
      await servePages(context);
      await page.emulateMedia({ colorScheme: scheme });
      await openAt(page, "/#/lesson/i-7", overviewAt("i-7"));
      await readButton(page).click();
      const dialog = page.getByRole("dialog", { name: MCP });
      await expect(dialog.locator(".markdown-alert").first()).toBeVisible();
      const img = dialog.locator("picture.diagram img").first();
      await expect(img).toBeVisible();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc))
        .toMatch(new RegExp(`\\.${scheme}\\.svg$`));
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    });
  }

  test("follows the app's data-theme over the system theme", async ({
    page,
    context,
  }) => {
    await servePages(context);
    await page.emulateMedia({ colorScheme: "dark" });
    await openAt(page, "/#/lesson/i-7", overviewAt("i-7"));
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await readButton(page).click();
    const img = page
      .getByRole("dialog", { name: MCP })
      .locator("picture.diagram img")
      .first();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc))
      .toMatch(/\.light\.svg$/);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc))
      .toMatch(/\.dark\.svg$/);
  });

  test("a heading link scrolls the panel and leaves the address alone", async ({
    page,
    context,
  }) => {
    // The MCP page has no heading links; b-3's page has.
    await servePages(context);
    await openAt(page, "/#/lesson/b-3", overviewAt("b-3"));
    await readButton(page).click();
    const dialog = page.getByRole("dialog", {
      name: titleOf("docs/beginner/03-first-change.md"),
    });
    const body = dialog.locator("[data-panel-body]");
    const link = dialog.locator('.page-prose a[href^="#"]').first();
    await expect(link).toBeVisible();
    const before = page.url();
    await link.click();
    await expect
      .poll(() => body.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    expect(page.url()).toBe(before);
  });

  test("a link to a bundled page opens it in the panel, and Back returns", async ({
    page,
    context,
  }) => {
    await servePages(context);
    await openAt(page, "/#/lesson/i-7", overviewAt("i-7"));
    await readButton(page).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(MCP);
    const link = dialog.locator(".page-prose a[data-page]").first();
    const path = await link.getAttribute("data-page");
    expect(path).not.toBeNull();
    await link.click();
    await expect(dialog).toHaveAccessibleName(titleOf(path ?? ""));
    await expect(dialog.getByRole("heading", { level: 1 })).toBeFocused();
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog).toHaveAccessibleName(MCP);
  });

  test("a link elsewhere opens GitHub at the release ref in a new tab", async ({
    page,
    context,
  }) => {
    // The hooks page links its example's README, which the release does not
    // render (MCP's only such link was its Level README, now a page).
    await servePages(context);
    await openAt(page, "/#/lesson/i-5", overviewAt("i-5"));
    await readButton(page).click();
    const dialog = page.getByRole("dialog", {
      name: titleOf("docs/intermediate/05-hooks.md"),
    });
    const outside = dialog
      .locator(`.page-prose a[href^="${GUIDE}/blob/"]:not([data-page])`)
      .first();
    await expect(outside).toHaveAttribute("target", "_blank");
    await expect(outside).toHaveAttribute("rel", "noopener noreferrer");
    await expect(outside).toHaveAttribute(
      "href",
      new RegExp(`^${GUIDE}/blob/${pageIndex.ref}/`),
    );
  });
});

// A code block wider than the panel scrolls inside itself, at the top level
// and inside a list item, and the panel itself never scrolls sideways (347).
test.describe("a long code block scrolls inside itself", () => {
  const PERMISSIONS = "docs/beginner/02-permission-modes-and-plan-mode.md";
  const file = "/pages/beginner/02-permission-modes-and-plan-mode.html";
  const long = `${"a-very-long-command --with-a-flag ".repeat(12)}end`;
  const html =
    readFileSync(join(PAGES_DIR, file.slice("/pages/".length)), "utf8") +
    `<pre><code>${long}</code></pre>\n<ol><li><p>A step:</p><pre><code>${long}</code></pre></li></ol>\n`;

  for (const width of [375, 1280, 1920]) {
    test(`at ${String(width)} px`, async ({ page, context }) => {
      await servePages(context, { [file]: html });
      await page.setViewportSize({ width, height: 900 });
      await openAt(page, "/#/lesson/b-2", overviewAt("b-2"));
      await readButton(page).click();
      const dialog = page.getByRole("dialog", { name: titleOf(PERMISSIONS) });
      const pres = dialog
        .locator(".page-prose pre")
        .filter({ hasText: "a-very-long-command" });
      await expect(pres).toHaveCount(2);
      for (const pre of await pres.all())
        expect(
          await pre.evaluate((el) => el.scrollWidth > el.clientWidth),
        ).toBe(true);
      const body = dialog.locator("[data-panel-body]");
      const sizes = await body.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
    });
  }
});

// Pip's rest is the director's (director.test.ts) on the pagePanel input,
// which PagePanel.test.tsx sees sent; the renderer shows no mode to assert.
test("Tab stays inside, Escape closes and focus returns", async ({
  page,
  context,
}) => {
  await servePages(context);
  await openAt(page, "/#/lesson/b-3/step", playingB3);
  const open = readButton(page);
  await open.click();
  const dialog = page.getByRole("dialog", {
    name: titleOf("docs/beginner/03-first-change.md"),
  });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test.describe("which page Read the full lesson opens", () => {
  test("a step of b-3 opens b-3's page", async ({ page, context }) => {
    await servePages(context);
    await openAt(page, "/#/lesson/b-3/step", playingB3);
    await readButton(page).click();
    await expect(
      page.getByRole("dialog", {
        name: titleOf("docs/beginner/03-first-change.md"),
      }),
    ).toBeVisible();
  });

  test("b-2's warm-up opens b-1's page", async ({ page, context }) => {
    await servePages(context);
    await openAt(page, "/#/lesson/b-2/step", warmupB2);
    await readButton(page).click();
    await expect(
      page.getByRole("dialog", {
        name: titleOf("docs/beginner/01-install-and-look-around.md"),
      }),
    ).toBeVisible();
  });

  test("a Level index warm-up opens the Level's README in the panel", async ({
    page,
    context,
  }) => {
    const asked = await servePages(context);
    await openAt(page, "/#/lesson/i-1/step", indexWarmupI1);
    await readButton(page).click();
    const dialog = page.getByRole("dialog", {
      name: titleOf("docs/beginner/README.md"),
    });
    await expect(dialog).toBeVisible();
    expect(asked).toContain("/pages/beginner/README.html");
    await expect(
      dialog.getByRole("link", { name: "Stuck on this lesson? Tell us" }),
    ).toHaveAttribute("href", /lesson=i-1/);
  });
});

test("an Elective opens from its Level card", async ({ page, context }) => {
  const asked = await servePages(context);
  await openAt(page, "/#/journey", overviewAt("b-4"));
  expect(asked).toEqual([]);
  await page.getByText("Electives").nth(1).click();
  const elective = pageIndex.pages.find(
    (p) => p.kind === "elective" && p.path.startsWith("docs/intermediate/"),
  );
  if (!elective) throw new Error("no Intermediate Elective");
  const button = page.getByRole("button", { name: elective.title });
  await expect(button).toBeVisible();
  expect(asked).toEqual(["/pages/index.json"]);
  await button.click();
  await expect(
    page.getByRole("dialog", { name: elective.title }),
  ).toBeVisible();
});

test("Your card opens during a check, the check's result still lands, and Commands by level opens", async ({
  page,
  context,
}) => {
  await servePages(context);
  await openAt(page, "/#/lesson/b-1/step", watching, true);
  await page.getByRole("button", { name: "Your card" }).click();
  const card = page.getByRole("dialog", { name: "Your card" });
  await expect(card.getByRole("listitem")).toHaveCount(cardEntries.length);
  const base = snapshotOf(watching, {
    revision: 5,
    welcomed: true,
    course: fullCourse,
  });
  if (!watching.beat) throw new Error("watching has no beat");
  await page.evaluate(
    (frame) => {
      window.__questStream.snapshot(frame);
    },
    {
      ...base,
      learner: { ...base.learner, card: cardEntries },
      lesson: { ...watching, beat: { ...watching.beat, status: "done" } },
    },
  );
  await card.getByRole("button", { name: "Commands by level" }).click();
  const commands = page.getByRole("dialog", { name: "Commands by level" });
  await expect(commands).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(commands).toBeHidden();
  await expect(page.getByRole("button", { name: "Your card" })).toBeFocused();
  await expect(page.getByText("That step is done.")).toBeVisible();
});

test("Settings Help opens Commands by level and the Glossary in the panel, and shows the release the pages came from", async ({
  page,
  context,
}) => {
  await servePages(context);
  await openAt(page, "/#/journey", overviewAt("b-1"));
  const gear = page.getByRole("button", { name: "Settings" });
  for (const path of [
    "docs/reference/commands.md",
    "docs/reference/glossary.md",
  ]) {
    await gear.click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings.locator("[data-ref]")).toHaveAttribute(
      "data-ref",
      pageIndex.ref,
    );
    await settings.getByRole("button", { name: titleOf(path) }).click();
    const panel = page.getByRole("dialog", { name: titleOf(path) });
    await expect(
      panel.getByRole("heading", { level: 1, name: titleOf(path) }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(gear).toBeFocused();
  }
});
