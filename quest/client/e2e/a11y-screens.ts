// Every screen, panel and notice the accessibility specs open (255), each a
// recipe on the faked stream (live.ts) that leaves the page ready: a screen
// shows its title, a panel its dialog, a notice its words.
import type { BrowserContext, Page } from "@playwright/test";
import { connected, expect, sendEvents } from "./live.ts";
import { i1Asking, overviews, walkCourse } from "./overviews.ts";
import { servePages } from "./pages.ts";
import {
  askBeat,
  cardEntries,
  complete,
  completeCapstone,
  beginnerDone,
  courseDone,
  fullCourse,
  hinted,
  learnerBeat,
  offersBoth,
  overview,
  overviewAt,
  predictBeat,
  snapshotOf,
  someMastery,
  stepDown,
  stepDownGuided,
  typeBeat,
  waitQuestionOpen,
  watching,
  whenOption,
} from "./snapshots.ts";

type Lesson = Parameters<typeof snapshotOf>[0];
type Options = Parameters<typeof snapshotOf>[1];

export interface Row {
  name: string;
  kind: "screen" | "panel" | "notice";
  /** Opens the row on a page whose stream is manual. */
  open(page: Page, context: BrowserContext): Promise<void>;
  /** A panel's opener, which Escape gives focus back to. */
  opener?: string;
  /** The row takes the slow notice timers. */
  slow?: boolean;
}

export const title = (page: Page) => page.locator("[data-page-title]").first();

/** `route` with `lesson`'s snapshot, waiting for the screen's title. */
async function at(
  page: Page,
  route: string,
  lesson: Lesson,
  options: Options = {},
  card = false,
) {
  await page.goto(route);
  const data = snapshotOf(lesson, options);
  await connected(
    page,
    card ? { ...data, learner: { ...data.learner, card: cardEntries } } : data,
  );
  await expect(title(page)).toBeVisible();
}

const step = (lesson: Lesson) => (page: Page) =>
  at(page, `/#/lesson/${lesson.id}/step`, lesson);

const whole = { welcomed: true, course: fullCourse };

/** Opens a dialog by its opener's name; waits for the dialog. */
async function panel(page: Page, opener: string, name: string) {
  await page.getByRole("button", { name: opener, exact: true }).click();
  await expect(page.getByRole("dialog", { name })).toBeVisible();
}

const b1 = overviews.find((lesson) => lesson.id === "b-1");
if (!b1) throw new Error("no b-1 overview");

export const SCREENS: Row[] = [
  {
    name: "Welcome",
    kind: "screen",
    open: (page) => at(page, "/", overview, { welcomed: false }),
  },
  {
    name: "Welcome to resume",
    kind: "screen",
    open: (page) => at(page, "/", watching, { welcomed: true }),
  },
  {
    name: "Journey",
    kind: "screen",
    open: (page) => at(page, "/#/journey", overviewAt("b-4"), whole),
  },
  {
    name: "Journey with Electives open",
    kind: "screen",
    open: async (page, context) => {
      await servePages(context);
      await at(page, "/#/journey", overviewAt("b-4"), whole);
      await page.getByText("Electives").nth(1).click();
      await expect(
        page.locator("[data-level-footer] details[open]"),
      ).toHaveCount(1);
    },
  },
  {
    name: "Lesson overview b-1",
    kind: "screen",
    open: (page) => at(page, "/#/lesson/b-1", overview, { welcomed: true }),
  },
  {
    name: "Lesson overview i-7",
    kind: "screen",
    open: async (page, context) => {
      await servePages(context);
      await at(page, "/#/lesson/i-7", overviewAt("i-7"), whole);
    },
  },
  {
    name: "Folder question",
    kind: "screen",
    open: async (page) => {
      await at(page, "/#/lesson/i-1", i1Asking, {
        welcomed: true,
        course: walkCourse,
      });
      await expect(page.locator("[data-folder-question]")).toBeAttached();
    },
  },
  {
    name: "Start over",
    kind: "screen",
    open: async (page) => {
      await at(
        page,
        "/#/lesson/b-1",
        { ...b1, resumable: true },
        { welcomed: true, course: walkCourse },
      );
      await page.getByRole("button", { name: "Start over" }).click();
      await expect(
        page.getByRole("group", { name: "Start over" }),
      ).toBeVisible();
    },
  },
  { name: "Workspace watching", kind: "screen", open: step(watching) },
  {
    name: "Workspace with Back and Skip",
    kind: "screen",
    open: step(offersBoth),
  },
  { name: "Workspace ask", kind: "screen", open: step(askBeat) },
  { name: "Workspace typed answer", kind: "screen", open: step(typeBeat) },
  { name: "Workspace guess", kind: "screen", open: step(predictBeat) },
  { name: "Workspace choice", kind: "screen", open: step(whenOption) },
  { name: "Workspace self-check", kind: "screen", open: step(learnerBeat) },
  {
    name: "Workspace with a hint",
    kind: "screen",
    open: async (page) => {
      await step(hinted)(page);
      await expect(page.locator("[data-pip-target=hint]")).toBeVisible();
    },
  },
  {
    name: "Workspace help offer",
    kind: "screen",
    open: async (page) => {
      await step(watching)(page);
      for (const id of ["c.1", "c.2"])
        await sendEvents(page, [
          {
            id,
            type: "check.notYet",
            evidence: "No commit yet",
            revision: 1,
            serverTime: Date.now(),
          },
        ]);
      await expect(
        page.getByRole("button", { name: "Show the hint" }),
      ).toBeVisible();
    },
  },
  {
    name: "Workspace waiting question",
    kind: "screen",
    open: step(waitQuestionOpen),
  },
  { name: "Step-down", kind: "screen", open: step(stepDown) },
  { name: "Step-down from Guided", kind: "screen", open: step(stepDownGuided) },
  {
    name: "Lesson complete",
    kind: "screen",
    open: (page) => at(page, "/#/lesson/b-1/complete", complete),
  },
  {
    name: "Level complete",
    kind: "screen",
    open: (page) =>
      at(page, "/#/level/b/complete", completeCapstone, {
        course: beginnerDone,
      }),
  },
  {
    name: "Course complete",
    kind: "screen",
    open: (page) =>
      at(page, "/#/course/complete", complete, { course: courseDone }),
  },
  {
    name: "Progress",
    kind: "screen",
    open: (page) =>
      at(page, "/#/progress", overviewAt("b-4"), {
        ...whole,
        mastery: someMastery,
      }),
  },
  {
    name: "Not found",
    kind: "screen",
    open: (page) => at(page, "/#/nope", overview, { welcomed: true }),
  },
];

export const PANELS: Row[] = [
  {
    name: "Steps",
    kind: "panel",
    opener: "Steps",
    open: async (page) => {
      await step(watching)(page);
      await panel(page, "Steps", "Steps");
    },
  },
  {
    name: "Settings",
    kind: "panel",
    opener: "Settings",
    open: async (page, context) => {
      await servePages(context);
      await step(watching)(page);
      await panel(page, "Settings", "Settings");
    },
  },
  {
    name: "Your card",
    kind: "panel",
    opener: "Your card",
    open: async (page, context) => {
      await servePages(context);
      await at(page, "/#/lesson/b-1/step", watching, whole, true);
      await panel(page, "Your card", "Your card");
    },
  },
  {
    name: "Commands by level",
    kind: "panel",
    opener: "Your card",
    open: async (page, context) => {
      await servePages(context);
      await at(page, "/#/lesson/b-1/step", watching, whole, true);
      await panel(page, "Your card", "Your card");
      await page
        .getByRole("dialog", { name: "Your card" })
        .getByRole("button", { name: "Commands by level" })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Commands by level" }),
      ).toBeVisible();
    },
  },
  {
    name: "Page panel",
    kind: "panel",
    opener: "Read the full lesson",
    open: async (page, context) => {
      await servePages(context);
      await at(page, "/#/lesson/i-7", overviewAt("i-7"), whole);
      await panel(page, "Read the full lesson", "Connect a tool with MCP");
    },
  },
  {
    name: "Glossary",
    kind: "panel",
    opener: "Settings",
    open: async (page, context) => {
      await servePages(context);
      await at(page, "/#/journey", overviewAt("b-1"), whole);
      await panel(page, "Settings", "Settings");
      await page
        .getByRole("dialog", { name: "Settings" })
        .getByRole("button", { name: "Glossary" })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Glossary" }),
      ).toBeVisible();
    },
  },
];

const notice = (page: Page) => page.locator("[data-notice-region]");

export const NOTICES: Row[] = [
  {
    name: "Reconnecting",
    kind: "notice",
    open: async (page) => {
      await step(watching)(page);
      await page.evaluate(() => {
        window.__questStream.fail();
      });
      await expect(notice(page)).toHaveText(/Reconnecting/, { timeout: 6000 });
    },
  },
  {
    name: "Stopped",
    kind: "notice",
    slow: true,
    open: async (page) => {
      await page.route("**/api/health", (route) => route.abort());
      await step(watching)(page);
      await page.evaluate(() => {
        window.__questStream.down(true);
        window.__questStream.fail();
      });
      await expect(notice(page)).toHaveText(/Claude Code Quest stopped/, {
        timeout: 25_000,
      });
    },
  },
];
