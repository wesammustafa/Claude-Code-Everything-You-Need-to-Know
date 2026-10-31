// Pip in a browser without WebGL2: Chromium started with WebGL2 turned off,
// so the runtime's renderer could never start. Its own file, since a browser
// launched with other flags needs a worker of its own.
import { expect, test } from "./live.ts";
import { ONLY_LOOPBACK } from "../playwright.config.ts";
import { RIG, RUNTIME, STEP, WASM, lessonUsable, pip } from "./pip-page.ts";
import { watch } from "./watch.ts";

test.use({ launchOptions: { args: [ONLY_LOOPBACK, "--disable-webgl2"] } });

test("Rive unavailable without WebGL2: the poster stays, nothing of the runtime is fetched, no error reaches the page, and the Lesson is usable", async ({
  page,
}) => {
  const seen = watch(page);
  await page.goto(STEP);
  await expect(pip(page)).toHaveAttribute("data-pip-rendering", "unavailable");
  await expect(pip(page).locator("img[data-pip-poster=idle]")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(pip(page).locator("canvas")).toHaveCount(0);
  await lessonUsable(page);
  expect(
    seen.requests
      .filter(
        (url) =>
          RUNTIME.test(url.pathname) ||
          WASM.test(url.pathname) ||
          RIG.test(url.pathname),
      )
      .map(String),
  ).toEqual([]);
  expect(seen.problems).toEqual([]);
});
