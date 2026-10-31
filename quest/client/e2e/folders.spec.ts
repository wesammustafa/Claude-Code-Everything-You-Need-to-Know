// Work folders and new copies in the browser (252): the built app run in a
// fresh Practice copy (practice-copy.ts) with a format-1 save that opens it
// on a later Lesson's overview, as the Terminal app's saves look
// (quest/host/test/fixtures/terminal-saves/). Correct folder selection,
// with Advanced's special cases: a Work folder for Intermediate, the new copy
// for a-5 and this practice copy refused for it, i-capstone pinned, and
// --dir at start-up.
import { expect, test, type Page } from "@playwright/test";
import {
  practiceCopy,
  type PracticeCopy,
  type PracticeCopyOptions,
} from "./practice-copy.ts";

test.use({ viewport: { width: 1280, height: 900 } });
// Copying the template and starting the app, on a busy machine.
test.setTimeout(90_000);

/** The template's Lessons in course order (practice-template/PATH.md). */
const LESSONS = [
  "b-1",
  "b-2",
  "b-3",
  "b-4",
  "b-5",
  "b-capstone",
  "i-1",
  "i-2",
  "i-3",
  "i-4",
  "i-5",
  "i-6",
  "i-7",
  "i-8",
  "i-capstone",
  "a-1",
  "a-2",
  "a-3",
  "a-4",
  "a-5",
  "a-6",
  "a-7",
  "a-capstone",
];

/** A format-1 save with every Lesson before `id` complete. */
function saveBefore(id: string, folders: Record<string, string> = {}) {
  const before = LESSONS.slice(0, LESSONS.indexOf(id));
  return JSON.stringify({
    format: 1,
    welcomed: true,
    eased: [],
    missed: [],
    lessons: Object.fromEntries(before.map((l) => [l, { complete: true }])),
    folders,
  });
}

async function withCopy(
  at: string,
  options: PracticeCopyOptions & {
    folders?: (copy: PracticeCopy) => Record<string, string>;
  },
  run: (copy: PracticeCopy) => Promise<void>,
  before?: (copy: PracticeCopy) => void,
) {
  const copy = practiceCopy(options);
  try {
    before?.(copy);
    copy.write(".practice/learn.json", saveBefore(at, options.folders?.(copy)));
    await copy.start();
    await run(copy);
  } finally {
    await copy.dispose();
  }
}

/**
 * To Lesson `id`'s overview: from Welcome to the course's next Lesson, or,
 * where that is another (a-5 with no new copy saved is not next), by its
 * route and Open this lesson.
 */
async function openOverview(page: Page, copy: PracticeCopy, id?: string) {
  if (id === undefined) {
    await page.goto(copy.url);
    await page.getByRole("button", { name: "Start the first lesson" }).click();
  } else {
    await page.goto(`${copy.url}/#/lesson/${id}`);
    const open = page.getByRole("button", { name: "Open this lesson" });
    await expect(open.or(page.locator("[data-folder-question]"))).toBeVisible();
    if (await open.isVisible()) await open.click();
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

const slot = (page: Page) => page.getByRole("region", { name: "Work folder" });
const startButton = (page: Page) =>
  page.getByRole("button", { name: "Start", exact: true });
const folders = (copy: PracticeCopy) =>
  (copy.saved() as { folders?: Record<string, string> } | null)?.folders ?? {};

test("8a: Intermediate's first overview asks, and this practice copy is the default answer", async ({
  page,
}) => {
  await withCopy("i-1", {}, async (copy) => {
    await openOverview(page, copy);
    await expect(
      slot(page).getByRole("heading", {
        name: "The work folder for Intermediate",
      }),
    ).toBeVisible();
    await expect(startButton(page)).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: "In this practice copy" }),
    ).toBeChecked();
    await slot(page).getByRole("button", { name: "Use this folder" }).click();
    await expect(slot(page)).toContainText("Work folder: this practice copy");
    await expect(startButton(page)).toBeFocused();
    await expect.poll(() => folders(copy).intermediate).toBe(copy.dir);
  });
});

test("8b: another folder: a repository in home is saved; a relative path is turned down before it is sent", async ({
  page,
}) => {
  await withCopy("i-1", {}, async (copy) => {
    const mine = copy.repo("mine");
    await openOverview(page, copy);
    await page
      .getByRole("radio", {
        name: "In another folder, such as your repository",
      })
      .click();
    const field = page.getByRole("textbox", { name: "The folder's full path" });
    await field.fill("mine");
    await slot(page).getByRole("button", { name: "Use this folder" }).click();
    await expect(slot(page).getByRole("alert")).toContainText("full path");
    await field.fill(mine);
    await slot(page).getByRole("button", { name: "Use this folder" }).click();
    await expect(slot(page)).toContainText(`Work folder: ${mine}`);
    await expect.poll(() => folders(copy).intermediate).toBe(mine);
    // Change opens the question again, with the answer kept until it is replaced.
    await slot(page).getByRole("button", { name: "Change" }).click();
    await slot(page).getByRole("button", { name: "Cancel" }).click();
    await expect(slot(page)).toContainText(`Work folder: ${mine}`);
  });
});

test("8c: a-5 asks for its new copy, refuses this practice copy, and runs nothing until it has one", async ({
  page,
}) => {
  await withCopy("a-5", { inHome: true }, async (copy) => {
    const fresh = copy.templateCopy("actions-practice");
    await openOverview(page, copy, "a-5");
    await expect(
      slot(page).getByRole("heading", {
        name: "Give the folder of your new copy",
      }),
    ).toBeVisible();
    await expect(slot(page).getByRole("radio")).toHaveCount(0);
    await expect(startButton(page)).toHaveCount(0);
    const field = page.getByRole("textbox", { name: "The folder's full path" });
    await field.fill(copy.dir);
    await slot(page).getByRole("button", { name: "Use this folder" }).click();
    await expect(slot(page).getByRole("alert")).toContainText(
      "That is this practice copy",
    );
    expect(folders(copy)["a-5"]).toBeUndefined();
    await field.fill(fresh);
    await slot(page).getByRole("button", { name: "Use this folder" }).click();
    await expect(slot(page)).toContainText(`Work folder: ${fresh}`);
    await expect(startButton(page)).toBeVisible();
    await expect.poll(() => folders(copy)["a-5"]).toBe(fresh);
  });
});

test("8d: i-capstone is pinned to the practice copy: no folder question", async ({
  page,
}) => {
  await withCopy(
    "i-capstone",
    { folders: (copy) => ({ intermediate: copy.dir }) },
    async (copy) => {
      await openOverview(page, copy);
      await expect(page.locator("[data-folder-question]")).toHaveCount(0);
      await expect(startButton(page)).toBeVisible();
    },
  );
});

test("8e: Settings changes a saved folder, and a refusal is worded", async ({
  page,
}) => {
  await withCopy(
    "i-2",
    { folders: (copy) => ({ intermediate: copy.dir }) },
    async (copy) => {
      const other = copy.repo("other");
      const loose = copy.repo("loose");
      await openOverview(page, copy);
      await page.getByRole("button", { name: "Settings" }).click();
      const region = page
        .getByRole("dialog", { name: "Settings" })
        .getByRole("region", { name: "Work folders" });
      const row = region.locator("[data-work-folder='intermediate']");
      await expect(row).toContainText("This practice copy");
      await row.getByRole("button", { name: /Change/ }).click();
      await region.getByRole("radio", { name: /another folder/ }).click();
      const field = region.getByRole("textbox");
      await field.fill(`${loose}/sub`);
      await region.getByRole("button", { name: "Use this folder" }).click();
      await expect(region.getByRole("alert")).toContainText("no folder");
      await field.fill(other);
      await region.getByRole("button", { name: "Use this folder" }).click();
      await expect.poll(() => folders(copy).intermediate).toBe(other);
      await expect(row).toContainText(other);
    },
  );
});

test("8f: --dir sets the opening Level's Work folder at start-up", async ({
  page,
}) => {
  let mine = "";
  await withCopy(
    "i-1",
    { argv: ["--dir", "../home/mine"] },
    async (copy) => {
      await openOverview(page, copy);
      await expect(slot(page)).toContainText(`Work folder: ${mine}`);
      await expect(startButton(page)).toBeVisible();
      await expect.poll(() => folders(copy).intermediate).toBe(mine);
    },
    (copy) => {
      mine = copy.repo("mine");
    },
  );
});

test("8g: --dir with a folder it refuses starts without it and says why", async ({
  page,
}) => {
  await withCopy("i-1", { argv: ["--dir", "/"] }, async (copy) => {
    expect(copy.output()).toContain(
      "--dir /: that folder is outside your home folder: starting without it.",
    );
    await openOverview(page, copy);
    await expect(
      slot(page).getByRole("heading", {
        name: "The work folder for Intermediate",
      }),
    ).toBeVisible();
    await expect(startButton(page)).toHaveCount(0);
  });
});
