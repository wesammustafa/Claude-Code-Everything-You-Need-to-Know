import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Pip's icon is the favicon and the top bar's brand mark. Its colours here are
// the tokens' values; src/pip/icon.test.ts measures their contrast.
const FAVICON = readFileSync(
  join(import.meta.dirname, "../public/favicon.svg"),
  "utf8",
);

// A computed colour as rgb(): a color-mix() token computes to color(srgb ...),
// which paints as its nearest 8-bit value.
function rgb(computed: string): string {
  const srgb = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(computed);
  if (srgb === null) return computed;
  const channels = srgb.slice(1).map((c) => Math.round(Number(c) * 255));
  return `rgb(${channels.join(", ")})`;
}

test("the favicon is Pip's icon, served from the app's own origin", async ({
  page,
}) => {
  await page.goto("/#/journey");
  const link = page.locator('link[rel="icon"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("type", "image/svg+xml");
  const href = await link.evaluate((el) => (el as HTMLLinkElement).href);
  expect(new URL(href).origin).toBe(new URL(page.url()).origin);

  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await response.text()).toBe(FAVICON);

  // The browser decodes it as an image at the favicon's own sizes.
  const sizes = await page.evaluate(async (src) => {
    const img = new Image(16, 16);
    img.src = src;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, href);
  expect(sizes[0]).toBeGreaterThan(0);
  expect(sizes[1]).toBe(sizes[0]);
});

for (const [scheme, body, shade] of [
  ["dark", "rgb(255, 120, 78)", "rgb(217, 90, 58)"],
  ["light", "rgb(217, 90, 58)", "rgb(180, 78, 52)"],
] as const) {
  test(`the top bar's brand mark is Pip's icon, ${scheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/#/journey");
    const home = page.getByRole("banner").getByRole("link", {
      name: "Claude Code Quest",
    });
    const icon = home.locator("svg[data-pip-icon]");
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(
      page.getByRole("banner").locator("[data-pip], img, canvas"),
    ).toHaveCount(0);

    const box = await icon.boundingBox();
    expect(box?.width).toBe(24);
    expect(box?.height).toBe(24);

    // The same parts as the favicon, in the theme's colours.
    const parts = await icon
      .locator("path")
      .evaluateAll((paths) =>
        paths.map((p) => [p.getAttribute("d") ?? "", getComputedStyle(p).fill]),
      );
    const favicon = [
      ...FAVICON.matchAll(/<path class="(\w+)" d="([^"]+)"\/>/g),
    ].map(([, tone, d]) => [tone, d]);
    const fills: Record<string, string> = {
      body,
      shade,
      eye: "rgb(30, 30, 30)",
    };
    expect(parts.map(([d, fill = ""]) => [d, rgb(fill)])).toEqual(
      favicon.map(([tone = "", d]) => [d, fills[tone]]),
    );
  });
}
