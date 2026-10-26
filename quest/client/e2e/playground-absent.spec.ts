// The Pip Playground is development-only. build/playground-absent.test.ts
// proves the release build holds none of its route, code, stylesheet or the
// board, without a browser; this checks the built app in one: it has no
// screen at the Playground's address.
import { expect, test } from "@playwright/test";

test("the built app has no screen at the Playground's address", async ({
  page,
}) => {
  await page.goto("/#/playground");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nothing here",
  );
});
