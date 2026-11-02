// Terminal rules re-homed in the browser (254), on the built app in a fresh
// Practice copy (practice-copy.ts) with a format-1 save: Check again over a
// Not yet with a hint open (rehoming row 157); a passed step that is current
// again on Back and on a replay from the journey (rows 172, 611, 616); a
// Check that goes on through a trip to the journey (rows 620, 742); and a
// code block's line numbers and its long line shown whole (rows 386, 387).
import { expect, test, type Page } from "@playwright/test";
import { actionsOf, bar, heading, move, saveAt, saveBefore } from "./play.ts";
import { practiceCopy, type PracticeCopy } from "./practice-copy.ts";

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 1280, height: 900 } });
test.setTimeout(120_000);

async function withCopy(
  save: (copy: PracticeCopy) => string,
  body: (copy: PracticeCopy) => Promise<void>,
) {
  const copy = practiceCopy();
  try {
    copy.write(".practice/learn.json", save(copy));
    await copy.start();
    await body(copy);
  } finally {
    await copy.dispose();
  }
}

/** From Welcome's resume card to the saved step. */
async function resume(page: Page, copy: PracticeCopy, title: string) {
  await page.goto(copy.url);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(heading(page)).toHaveText(title);
}

/** b-1's note with its wrong claim corrected (b1-slice.spec.ts). */
const CORRECTED =
  "- linkcheck exits with code 1 when it finds broken links, so it can fail a CI job.\n";

const checkAgain = (page: Page) =>
  bar(page).getByRole("button", { name: "Check again" });
const notYet = (page: Page) => page.locator("[data-state=not-yet]");
/** The step dot of the step titled `title`. */
const dot = (page: Page, title: string) =>
  page.getByRole("list", { name: "Steps" }).locator(`li[title="${title}"]`);

test("Check again over a Not yet with a hint open: Checking takes the Not yet's place, and the hint and the action bar stay (row 157)", async ({
  page,
}) => {
  await withCopy(
    () => saveAt("b-1", "Y3", 0),
    async (copy) => {
      await resume(page, copy, "Correct one claim");
      await checkAgain(page).click();
      await expect(notYet(page)).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Show a hint" }).click();
      const rungs = page.locator("[data-hint-rung]");
      await expect(rungs.first()).toBeVisible();
      const open = await rungs.count();
      // Every frame from here: what shows while the bubble says Checking.
      await page.evaluate(() => {
        const seen: { notYet: boolean; rungs: number; check: boolean }[] = [];
        (window as unknown as { __checking: typeof seen }).__checking = seen;
        const look = () => {
          const words =
            document.querySelector("[data-says-words]")?.textContent ?? "";
          if (!/^Checking/.test(words)) return;
          seen.push({
            notYet: document.querySelector("[data-state=not-yet]") !== null,
            rungs: document.querySelectorAll("[data-hint-rung]").length,
            check: [
              ...document.querySelectorAll("[data-action-bar] button"),
            ].some((b) => b.textContent === "Check again"),
          });
        };
        new MutationObserver(look).observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
        });
      });
      await checkAgain(page).click();
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                (window as unknown as { __checking: unknown[] }).__checking
                  .length,
            ),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0);
      const seen = await page.evaluate(
        () =>
          (
            window as unknown as {
              __checking: { notYet: boolean; rungs: number; check: boolean }[];
            }
          ).__checking,
      );
      for (const frame of seen)
        expect(frame).toEqual({ notYet: false, rungs: open, check: true });
      await expect(notYet(page)).toBeVisible({ timeout: 30_000 });
      await expect(rungs).toHaveCount(open);
    },
  );
});

test("a passed step is current again on Back, until it passes again (row 172)", async ({
  page,
}) => {
  await withCopy(
    () => saveAt("b-1", "Y2", 0),
    async (copy) => {
      await resume(page, copy, "Read the cited lines");
      for (let moves = 0; moves < 10; moves += 1) {
        if ((await heading(page).innerText()) === "Correct one claim") break;
        await move(page);
      }
      await expect(heading(page)).toHaveText("Correct one claim");
      const y2 = dot(page, "Read the cited lines");
      await expect(y2).toHaveAttribute("data-state", "done");
      // Back is offered on a Not yet once the hints are used up (backOffered).
      await checkAgain(page).click();
      await expect(notYet(page)).toBeVisible({ timeout: 30_000 });
      const confirm = page.locator("[data-hints-confirm]");
      const another = page.getByRole("button", {
        name: /^(Show a hint|Another hint)$/,
      });
      const back = bar(page).getByRole("button", { name: "Back" });
      // The hint lock ignores a press within 2 s of the last one (rows 44 and
      // 605), so each press is retried after the lock until its rung shows.
      const rungs = page.locator("[data-hint-rung]");
      for (let i = 0; i < 10 && !(await back.isVisible()); i += 1) {
        const before = await rungs.count();
        await expect(async () => {
          if (await confirm.isVisible())
            await confirm
              .getByRole("button", { name: "Show the exact command" })
              .click();
          else await another.click();
          await expect
            .poll(
              async () =>
                (await back.isVisible()) || (await rungs.count()) > before,
              { timeout: 1_000 },
            )
            .toBe(true);
        }).toPass({ intervals: [2_100], timeout: 30_000 });
      }
      await back.click();
      await expect(heading(page)).toHaveText("Read the cited lines");
      await expect(y2).toHaveAttribute("data-state", "now");
      await expect(y2).toHaveAttribute("aria-current", "step");
      for (let moves = 0; moves < 10; moves += 1) {
        if ((await heading(page).innerText()) === "Correct one claim") break;
        await move(page);
      }
      await expect(y2).toHaveAttribute("data-state", "done");
    },
  );
});

test("a finished Lesson replayed from the journey opens its overview, and its first step is current until it passes (rows 172, 611, 616)", async ({
  page,
}) => {
  await withCopy(
    () => saveBefore("b-2"),
    async (copy) => {
      await page.goto(`${copy.url}/#/journey`);
      await page
        .getByRole("link", { name: /Install, sign in and look around/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Open this lesson" }).click();
      await expect(page).toHaveURL(/#\/lesson\/b-1$/);
      await expect(heading(page)).toHaveText(
        "Install, sign in and look around",
      );
      await page.getByRole("button", { name: "Start", exact: true }).click();
      await expect(page).toHaveURL(/#\/lesson\/b-1\/step$/);
      const first = page
        .getByRole("list", { name: "Steps" })
        .locator("li")
        .first();
      const title = (await first.getAttribute("title")) ?? "";
      await expect(heading(page)).toHaveText(title);
      await expect(first).toHaveAttribute("data-state", "now");
      for (let moves = 0; moves < 10; moves += 1) {
        if ((await heading(page).innerText()) !== title) break;
        await move(page);
      }
      await expect(first).toHaveAttribute("data-state", "done");
    },
  );
});

test("a Check goes on through a trip to the journey, and its result is on the card on return (rows 620, 742)", async ({
  page,
}) => {
  await withCopy(
    () => saveAt("b-1", "Y3", 0),
    async (copy) => {
      const sent = actionsOf(page);
      await resume(page, copy, "Correct one claim");
      // check.run is held on its way while the Learner leaves.
      await page.route("**/api/actions", async (route) => {
        await new Promise((done) => setTimeout(done, 1_500));
        await route.continue();
      });
      await checkAgain(page).click();
      // The fix lands while check.run is held, so the run finds it and passes.
      copy.write("project/practice/b-1/onboarding.md", CORRECTED);
      await page.getByRole("link", { name: "Journey" }).click();
      await expect(page).toHaveURL(/#\/journey$/);
      await page.waitForTimeout(2_500);
      await page.unroute("**/api/actions");
      await page.goBack();
      await expect(page).toHaveURL(/#\/lesson\/b-1\/step$/);
      await expect(heading(page)).toHaveText("Correct one claim");
      await expect(
        bar(page).getByRole("button", { name: "Next step" }),
      ).toBeVisible({ timeout: 30_000 });
      expect(sent.filter((a) => a.type === "check.run")).toHaveLength(1);
    },
  );
});

const HOOKS_URL =
  "https://raw.githubusercontent.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/main/examples/intermediate/05-hooks/dot-claude/hooks/$f.sh";

for (const width of [720, 1440])
  test(`i-5's code block: one number per line, and the long curl line wraps whole under its own number, at ${String(width)} px (rows 386, 387)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await withCopy(
      (copy) => saveAt("i-5", "W1", 0, { intermediate: copy.dir }),
      async (copy) => {
        await resume(page, copy, "Download two hooks");
        const block = page.locator("[data-code-block]");
        await expect(block).toBeVisible();
        const lines = await block.locator("[data-line]").evaluateAll((spans) =>
          spans.map((span) => {
            const [number, text] = [...span.children] as HTMLElement[];
            const style = getComputedStyle(span);
            return {
              n: span.getAttribute("data-line"),
              number: number?.textContent ?? "",
              text: text?.innerText ?? "",
              rows: Math.round(
                (text?.getBoundingClientRect().height ?? 0) /
                  parseFloat(style.lineHeight),
              ),
              // The number's own text, not its grid cell, which stretches.
              numberRows: (() => {
                if (!number) return 0;
                const range = document.createRange();
                range.selectNodeContents(number);
                return range.getClientRects().length;
              })(),
              clipped: (text?.scrollWidth ?? 0) > (text?.clientWidth ?? 0) + 1,
            };
          }),
        );
        expect(lines.map((l) => l.number)).toEqual(
          lines.map((_, i) => String(i + 1)),
        );
        const curl = lines.find((l) => l.text.includes("curl"));
        expect(curl?.text.replace(/\s+/g, " ")).toContain(HOOKS_URL);
        expect(curl?.text).not.toMatch(/(…|\.\.\.)$/);
        for (const line of lines) {
          expect(line.clipped, line.text).toBe(false);
          expect(line.numberRows, line.text).toBe(1);
        }
        if (width === 720) expect(curl?.rows ?? 0).toBeGreaterThan(1);
        const fit = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(fit.scroll).toBeLessThanOrEqual(fit.client);
        await expect(page.getByText("press p for the lesson page")).toHaveCount(
          0,
        );
      },
    );
  });

test("a welcomed copy at Welcome offers Continue to the next Lesson, never Start the first lesson, and it opens that Lesson (302)", async ({
  page,
}) => {
  await withCopy(
    () => saveBefore("b-2"),
    async (copy) => {
      await page.goto(copy.url);
      const go = page.getByRole("button", { name: /^Continue: / });
      await expect(go).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Start the first lesson" }),
      ).toHaveCount(0);
      const title = ((await go.textContent()) ?? "").replace(/^Continue: /, "");
      expect(title).not.toBe("");
      await go.click();
      await expect(page).toHaveURL(/#\/lesson\/b-2$/);
      await expect(heading(page)).toHaveText(title);
    },
  );
});
