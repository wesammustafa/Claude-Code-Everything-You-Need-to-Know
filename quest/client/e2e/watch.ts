// What a page does while a test runs: every request it makes, and every
// console error or warning and uncaught error it reports.
import type { Page } from "@playwright/test";

// Chromium's own notes about its GPU driver, which software WebGL (as on the
// CI runners) prints when Pip's runtime copies a frame out of the shared
// WebGL context. They come from the browser, not the page or the runtime.
const GPU_DRIVER_NOTE =
  /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \([^)]*Performance/;

export interface Watched {
  requests: URL[];
  problems: string[];
}

export function watch(page: Page): Watched {
  const requests: URL[] = [];
  const problems: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url())));
  page.on("console", (message) => {
    const type = message.type();
    if (type !== "error" && type !== "warning") return;
    if (type === "warning" && GPU_DRIVER_NOTE.test(message.text())) return;
    problems.push(`${type}: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    problems.push(`page error: ${error.message}`),
  );
  return { requests, problems };
}
