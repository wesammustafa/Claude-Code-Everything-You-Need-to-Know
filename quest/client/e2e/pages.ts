// The rendered pages, served to the preview build as the real server serves
// them: vite preview has no /pages/, so a context route answers each request
// from quest/release/dist/pages (npm run build makes it) and records it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";

export const PAGES_DIR = join(import.meta.dirname, "../../release/dist/pages");

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
};

/** The built index, as the page reads it. */
export const pageIndex = JSON.parse(
  readFileSync(join(PAGES_DIR, "index.json"), "utf8"),
) as {
  ref: string;
  pages: { path: string; url: string; title: string; kind: string }[];
};

/**
 * Serves /pages/ from the build, `overrides` (by URL path) first; returns
 * every /pages/ path asked for, oldest first.
 */
export async function servePages(
  context: BrowserContext,
  overrides: Record<string, string> = {},
): Promise<string[]> {
  const asked: string[] = [];
  await context.route("**/pages/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    asked.push(path);
    const type = TYPES[path.split(".").at(-1) ?? ""] ?? "text/plain";
    const override = overrides[path];
    if (override !== undefined)
      return route.fulfill({ body: override, contentType: type });
    try {
      const body = readFileSync(join(PAGES_DIR, path.slice("/pages/".length)));
      return route.fulfill({ body, contentType: type });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  return asked;
}
