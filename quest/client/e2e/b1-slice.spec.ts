// The b-1 slice in the browser (221): the built app run in a fresh Practice
// copy (practice-copy.ts), driven from Welcome to Lesson complete on the real
// engine, host and server. One copy per test, each on its own free port.
import { expect, test as base, type Page } from "@playwright/test";
import { practiceCopy, type PracticeCopy } from "./practice-copy.ts";
import { watch } from "./watch.ts";

const test = base.extend<{ copy: PracticeCopy }>({
  copy: [
    // eslint-disable-next-line no-empty-pattern -- Playwright reads the fixtures from the first argument's pattern.
    async ({}, provide) => {
      const copy = practiceCopy();
      try {
        await copy.start();
        await provide(copy);
      } finally {
        await copy.dispose();
      }
    },
    // Copying the template and starting the app, on a busy machine.
    { timeout: 60_000 },
  ],
});

test.use({ viewport: { width: 1280, height: 900 } });

/** The note's wrong claim, corrected to what src/cli.js does. */
const CORRECTED =
  "- linkcheck exits with code 1 when it finds broken links, so it can fail a CI job.\n";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const bar = (page: Page) => page.locator("[data-action-bar]");

/** Every action the page POSTs, in order. */
function actionsOf(page: Page): { type: string; [field: string]: unknown }[] {
  const sent: { type: string }[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST" || !request.url().endsWith("/api/actions"))
      return;
    const body = request.postDataJSON() as { action: { type: string } };
    sent.push(body.action);
  });
  return sent;
}

/** From Welcome to the b-1 overview. */
async function openB1(page: Page, copy: PracticeCopy) {
  await page.goto(copy.url);
  await page.getByRole("button", { name: "Start the first lesson" }).click();
  await expect(heading(page)).toHaveText("Install, sign in and look around");
}

/**
 * One move on the workspace, as a Learner makes it: go on from a done beat,
 * take a Step-down, answer a question (trying each answer in turn), run the
 * Check, or say a self beat is done. Resolves once the page shows the
 * engine's answer.
 */
async function move(page: Page) {
  const before = await page.locator("main").innerText();
  const next = bar(page).getByRole("button", { name: "Next step" });
  const check = bar(page).getByRole("button", { name: "Check again" });
  // The answers not tried yet: a wrong one stays marked, the next is tried.
  const untried = page.locator(
    "main fieldset:not([disabled]) label[data-state=idle]",
  );
  if ((await heading(page).innerText()) === "Less help from here") {
    await page.getByRole("button", { name: /^Go on/ }).click();
  } else if (await next.isVisible()) {
    await next.click();
  } else if ((await untried.count()) > 0) {
    await untried.first().click();
  } else if (await check.isVisible()) {
    await check.click();
    await expect(next.or(page.locator("[data-state=not-yet]"))).toBeVisible({
      timeout: 30_000,
    });
    return;
  } else {
    await bar(page).getByRole("button").last().click();
  }
  await expect
    .poll(() => page.locator("main").innerText(), { timeout: 15_000 })
    .not.toBe(before);
}

/** Moves on until the step's heading is `title`. */
async function playTo(page: Page, title: string) {
  for (let moves = 0; moves < 60; moves += 1) {
    if ((await heading(page).innerText()) === title) return;
    await move(page);
  }
  throw new Error(`Never reached ${title}`);
}

/** From Welcome to the Check step that reads the note: Y3, "Correct one claim". */
async function playToCheck(page: Page, copy: PracticeCopy) {
  await openB1(page, copy);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await playTo(page, "Correct one claim");
}

/** The note fails its Check, is fixed at `note`, passes, and b-1 completes. */
async function failThenPass(page: Page, copy: PracticeCopy, note: string) {
  const sent = actionsOf(page);
  await playToCheck(page, copy);
  const check = bar(page).getByRole("button", { name: "Check again" });
  await expect(check).toBeInViewport();

  // In flight, the button holds its pressed state; a double click posts once.
  await page.route("**/api/actions", async (route) => {
    await new Promise((done) => setTimeout(done, 400));
    await route.continue();
  });
  const before = sent.filter((a) => a.type === "check.run").length;
  await check.dblclick();
  await expect(check).toHaveAttribute("data-pending", "");
  await expect(check).not.toHaveAttribute("data-pending");
  expect(sent.filter((a) => a.type === "check.run").length - before).toBe(1);
  await page.unroute("**/api/actions");

  // Not yet, amber, with the Check's own line.
  const notYet = page.locator("[data-state=not-yet]");
  await expect(notYet).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("main")).toContainText(
    /is missing|still says|has no/,
  );

  // Check again is pressed before the note changes, and its action held until
  // the note is written: the host polls the copy every 2 seconds, and a poll
  // that passes the Check first turns this same button into Next step, so a
  // press after the write could go on to Y4 instead.
  const written = Promise.withResolvers<undefined>();
  await page.route("**/api/actions", async (route) => {
    await written.promise;
    await route.continue();
  });
  const asked = sent.length;
  await check.click();
  await expect(check).toHaveAttribute("data-pending", "");
  copy.write(note, CORRECTED);
  const answered = page.waitForResponse("**/api/actions");
  written.resolve(undefined);
  await answered;
  await page.unroute("**/api/actions");
  try {
    await expect(
      bar(page).getByRole("button", { name: "Next step" }),
    ).toBeVisible({ timeout: 30_000 });
  } catch (error) {
    // Say which item still fails, and what the app printed, not only that
    // the button never came.
    const shown = await page
      .locator("main")
      .innerText()
      .catch(() => "");
    throw new Error(
      `The corrected note did not pass its Check.\nPage:\n${shown}\nApp output:\n${copy.output()}`,
      { cause: error },
    );
  }
  // The press posted the Check, never Next step.
  const pressed = sent.slice(asked).map((a) => a.type);
  expect(pressed).toContain("check.run");
  expect(pressed).not.toContain("step.continue");

  await playTo(page, "Install, sign in and look around");
  await expect(page.getByText("Lesson 1 complete")).toBeVisible();
  await expect(page.getByText("New badge")).toBeVisible();
}

test.describe("a clean first launch", () => {
  test("greets by name, explains the two windows and starts b-1", async ({
    page,
    copy,
  }) => {
    const seen = watch(page);
    await page.goto(copy.url);
    // The first screen never waits for Pip's rig.
    await expect(heading(page)).toHaveText("Learn Claude Code by using it.");
    await expect(page.getByText("Hi Sam!")).toBeVisible();
    await expect(page.getByText("This page", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Your terminal", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start the first lesson" }).click();
    await expect(heading(page)).toHaveText("Install, sign in and look around");
    expect(page.url()).toMatch(/#\/lesson\/b-1$/);
    await expect(
      page.getByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
    expect(
      seen.requests.filter((url) => url.hostname !== "127.0.0.1").map(String),
    ).toEqual([]);
    expect(seen.problems).toEqual([]);
  });

  test("fits 720 px beside a terminal", async ({ page, copy }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto(copy.url);
    await expect(heading(page)).toBeVisible();
    for (const step of ["welcome", "overview"]) {
      if (step === "overview") await openB1(page, copy);
      const fit = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        main: document.querySelector("main")?.getBoundingClientRect().width,
      }));
      expect(fit.scroll).toBeLessThanOrEqual(fit.client);
      expect(fit.main ?? 0).toBeLessThanOrEqual(720);
    }
  });
});

test.describe("b-1 verified failure, then success", () => {
  // The Check reads the template's project/practice/b-1/onboarding.md: the
  // default Work folder is the copy's project/ (ticket 277).
  for (const width of [1280, 720]) {
    test(`after the work in the copy's project/, ${String(width)} px`, async ({
      page,
      copy,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await failThenPass(page, copy, "project/practice/b-1/onboarding.md");
    });
  }
});

test("resume after a server restart, at the same place", async ({
  page,
  copy,
}) => {
  test.setTimeout(90_000);
  await openB1(page, copy);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await playTo(page, "Compare the session");
  // The run wrote root .practice/learn.json; the restart reads it back.
  expect(copy.saved()).toMatchObject({
    welcomed: true,
    lessons: { "b-1": { step: "W4" } },
  });

  await copy.restart();
  // The same tab reconnects to the new server and returns to the step.
  await expect(heading(page)).toHaveText("Compare the session", {
    timeout: 20_000,
  });
  expect(page.url()).toMatch(/#\/lesson\/b-1\/step$/);

  // A reload through Welcome shows the resume card.
  await page.goto(copy.url);
  const card = page.getByRole("region", { name: "Where you left off" });
  // The new page waits for the restarted server's first snapshot.
  await expect(card.getByText("Step 4 of 11")).toBeVisible({
    timeout: 20_000,
  });
  await card.getByRole("button", { name: "Continue" }).click();
  await expect(heading(page)).toHaveText("Compare the session");
});

test("two tabs stay in step", async ({ page, copy, context }) => {
  await openB1(page, copy);
  const other = await context.newPage();
  await other.goto(`${copy.url}/#/lesson/b-1`);
  await expect(heading(other)).toHaveText("Install, sign in and look around");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(heading(page)).toHaveText("Run the installer");
  await expect(heading(other)).toHaveText("Run the installer");
  expect(other.url()).toMatch(/#\/lesson\/b-1\/step$/);
});

test("the disconnected notice when the server stops", async ({
  page,
  copy,
}) => {
  test.setTimeout(60_000);
  await openB1(page, copy);
  await copy.stop();
  const notice = page.locator("[data-notice]");
  await expect(notice).toHaveText(/Reconnecting to Claude Code Quest/, {
    timeout: 10_000,
  });
  await expect(notice).toContainText("Claude Code Quest stopped", {
    timeout: 30_000,
  });
  await expect(notice).toContainText("npm run learn");
});

test("no duplicate moment on reload or in a second tab", async ({
  page,
  copy,
  context,
}) => {
  test.setTimeout(150_000);
  const shown: string[] = [];
  context.on("request", (request) => {
    if (request.method() !== "POST" || !request.url().endsWith("/api/actions"))
      return;
    const { action } = request.postDataJSON() as {
      action: { type: string; id?: string };
    };
    if (action.type === "milestone.shown") shown.push(action.id ?? "");
  });
  await failThenPass(page, copy, "project/practice/b-1/onboarding.md");
  await expect.poll(() => shown.length).toBe(1);

  await page.reload();
  await expect(page.getByText("Lesson 1 complete")).toBeVisible();
  const other = await context.newPage();
  await other.goto(`${copy.url}/#/lesson/b-1/complete`);
  await expect(other.getByText("Lesson 1 complete")).toBeVisible();
  // Long enough for a claim and a POST to have happened.
  await page.waitForTimeout(1_000);
  await expect(page.getByText("New badge")).toHaveCount(0);
  await expect(other.getByText("New badge")).toHaveCount(0);
  expect(new Set(shown).size).toBe(shown.length);
  expect(shown).toHaveLength(1);
  // Pending milestones live in the server's memory only, never in the save.
  expect(JSON.stringify(copy.saved())).not.toContain("milestone");
});
