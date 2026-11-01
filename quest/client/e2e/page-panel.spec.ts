// The page panel (244): a rendered Guide page fetched when opened, in both
// themes, with its links each going to the right place; Pip resting beside
// it; the Electives on the Level cards and the skills card's hand-over.
import type { Page } from "@playwright/test";
import { connected, expect, test } from "./live.ts";
import { pageIndex, servePages } from "./pages.ts";
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

const GUIDE =
  "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know";
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
    await servePages(context);
    await openAt(page, "/#/lesson/i-7", overviewAt("i-7"));
    await readButton(page).click();
    const dialog = page.getByRole("dialog", { name: MCP });
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

  test("a Level index warm-up links the Level's README on GitHub", async ({
    page,
    context,
  }) => {
    await servePages(context);
    await openAt(page, "/#/lesson/i-1/step", indexWarmupI1);
    const link = page.getByRole("link", { name: "Read the full lesson" });
    await expect(link).toHaveAttribute(
      "href",
      `${GUIDE}/blob/main/docs/beginner/README.md`,
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // Pointing at it loads the index; the href then names the release ref.
    await link.hover();
    await expect(link).toHaveAttribute(
      "href",
      `${GUIDE}/blob/${pageIndex.ref}/docs/beginner/README.md`,
    );
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
