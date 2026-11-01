// The whole-course walks (254): every Lesson on a fresh Practice copy with
// the Reference solutions replayed through the one before it, from Welcome
// to its overview, through every beat with that Lesson's own solution in
// place (walk.ts), to Lesson complete, each Level's and the course's
// complete moment, and on to the next Lesson's overview.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { applyLesson, gitEnv, lessonOrder } from "../../release/src/replay.mjs";
import { actionsOf, heading, lessonsBefore, saveBefore } from "./play.ts";
import { practiceCopy, repoRoot, type PracticeCopy } from "./practice-copy.ts";
import {
  INVITATION,
  STAGE,
  UNREACHED,
  beatKey,
  courseLessons,
  expectedBeats,
  holdsScreen,
  recordFrames,
  takeOutFresh,
  walkLesson,
  warmupSkill,
} from "./walk.ts";
import { watch } from "./watch.ts";

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 1280, height: 900 } });
// Replaying up to 22 Lessons, then every beat of one.
test.setTimeout(300_000);

const ORDER = lessonOrder(repoRoot);

/** The Lessons that ask for a new copy of the template (a-5, a-capstone). */
const NEW_COPY = new Set(
  courseLessons()
    .filter((l) => l.newCopy)
    .map((l) => l.id),
);
/** Each Level's capstone, and its Level's name. */
const CAPSTONES: Record<string, string> = {
  "b-capstone": "Beginner",
  "i-capstone": "Intermediate",
  "a-capstone": "Advanced",
};

/** workspace-verify's rule: a Work folder Lesson keeps the copy itself. */
function folderFor(lesson: string, copy: PracticeCopy) {
  if (lesson.startsWith("i-")) return { intermediate: copy.dir };
  if (lesson.startsWith("a-")) return { advanced: copy.dir };
  return {};
}

/**
 * The new copy a Lesson asks for: a-5's is a new copy of the template, as
 * its page says; the Advanced capstone's solution builds on the earlier
 * Advanced work (a-4's review script, a-6's team kit), so its copy is a
 * clone of the Practice copy, with a bare remote to push to (254 D8).
 */
function newCopyFor(id: string, copy: PracticeCopy): string {
  if (id !== "a-capstone") return copy.templateCopy("actions-practice");
  const remote = join(copy.home, "capstone-remote.git");
  const path = join(copy.home, "capstone");
  for (const args of [
    ["clone", "-q", "--bare", copy.dir, remote],
    ["clone", "-q", remote, path],
  ]) {
    const run = spawnSync("git", args, { env: gitEnv(), encoding: "utf8" });
    if (run.status !== 0) throw new Error(`git clone failed: ${run.stderr}`);
  }
  return path;
}

const says = (page: Page) => page.locator("[data-says-bubble]");

/**
 * From Welcome to Lesson `id`'s overview, answering its folder question
 * with `folder` where it asks, and Start. Checks the overview on the way:
 * the payoff is Pip's one line, once (LR:1315).
 */
async function arrive(
  page: Page,
  copy: PracticeCopy,
  id: string,
  folder?: string,
) {
  await page.goto(copy.url);
  await expect(heading(page)).toBeVisible();
  await page.goto(`${copy.url}/#/lesson/${id}`);
  const open = page.getByRole("button", { name: "Open this lesson" });
  const start = page.getByRole("button", { name: "Start", exact: true });
  const question = page.locator("[data-folder-question]");
  await expect(open.or(start).or(question).first()).toBeVisible();
  if (await open.isVisible()) await open.click();
  await expect(says(page)).toHaveCount(1);
  const payoff = courseLessons().find((l) => l.id === id)?.content.intro
    ?.payoff;
  if (payoff !== undefined)
    await expect(says(page)).toContainText(payoff.replace(/`/g, ""));
  if (folder !== undefined) {
    await page
      .getByRole("textbox", { name: "The folder's full path" })
      .fill(folder);
    await page
      .getByRole("region", { name: "Work folder" })
      .getByRole("button", { name: "Use this folder" })
      .click();
  } else if (id === "i-capstone") {
    // Pinned to the Practice copy: the overview asks nothing (folders 8d).
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "The folder's full path" }),
    ).toHaveCount(0);
  }
  await start.click();
}

for (const id of ORDER)
  test(`walk ${id}: overview through complete on a fresh copy, replaying the Reference solutions @walk`, async ({
    page,
  }) => {
    const previous = lessonsBefore(id).at(-1);
    const newCopy = NEW_COPY.has(id);
    const copy = practiceCopy({
      inHome: newCopy,
      ...(previous === undefined ? {} : { through: previous }),
    });
    try {
      const save = JSON.parse(saveBefore(id, folderFor(id, copy))) as {
        missed: string[];
      };
      // A Lesson's warm-up plays only on a skill missed before.
      const skill = warmupSkill(id);
      if (skill !== null) save.missed = [skill];
      copy.write(".practice/learn.json", JSON.stringify(save));
      // A new copy's Lesson replays into that copy, the Work folder it gives.
      const fresh = newCopy ? newCopyFor(id, copy) : undefined;
      if (fresh === undefined) copy.apply(id);
      else applyLesson({ repoRoot, copy: fresh, id });
      const folder = join(fresh ?? copy.dir, "project");
      const taken = takeOutFresh(id, folder);
      const frames = await recordFrames(page);
      const seen = watch(page);
      const sent = actionsOf(page);
      await copy.start();
      await arrive(page, copy, id, fresh);

      const beats = await walkLesson(page, copy, id, frames, {
        taken,
        folder,
        onScreen: holdsScreen,
      });
      const missing = expectedBeats(id).filter(
        (key) => !beats.has(key) && !(key in UNREACHED),
      );
      expect(missing).toEqual([]);

      // Lesson complete: the invitation on a capstone only (LR:785; the
      // engine invites on all three, 254 D9), then the next Lesson's
      // overview, or the Level moment.
      await expect(page).toHaveURL(new RegExp(`#/lesson/${id}/complete$`));
      await expect(page.getByText(INVITATION)).toHaveCount(
        id in CAPSTONES ? 1 : 0,
      );
      const shown = () =>
        sent.filter((a) => a.type === "milestone.shown").map((a) => a.id);
      await expect.poll(() => shown().length).toBe(1);
      const level = CAPSTONES[id];
      if (level === undefined) {
        const next = ORDER[ORDER.indexOf(id) + 1] ?? "";
        await page.getByRole("button", { name: /^Next: / }).click();
        await expect(page).toHaveURL(new RegExp(`#/lesson/${next}$`));
        await expect(says(page)).toHaveCount(1);
      } else {
        await page
          .getByRole("link", { name: `See the ${level} level complete` })
          .click();
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: `${level} level complete`,
          }),
        ).toBeVisible();
        await expect.poll(() => shown().length).toBe(2);
        if (id === "a-capstone") {
          await page
            .getByRole("link", { name: "See the course complete" })
            .click();
          await expect(page.getByText("Course complete")).toBeVisible();
          await expect.poll(() => shown().length).toBe(3);
        }
      }
      // One milestone.shown per moment, never twice.
      expect(new Set(shown()).size).toBe(shown().length);
      expect(
        seen.requests.filter((url) => url.hostname !== "127.0.0.1"),
      ).toEqual([]);
      expect(seen.problems).toEqual([]);
    } finally {
      await copy.dispose();
    }
  });

/** Rewrites the replay's records under `repo`'s .practice/ as if made there. */
function ownRecords(project: string, repo: string) {
  const practice = join(repo, ".practice");
  if (!existsSync(practice)) return;
  for (const name of readdirSync(practice)) {
    // Text records only: a screenshot is bytes, and names no folder.
    if (!/\.(json|txt|html|md)$/.test(name)) continue;
    const file = join(practice, name);
    writeFileSync(file, readFileSync(file, "utf8").replaceAll(project, repo));
  }
  const commit = join(practice, "i-1-commit.txt");
  if (existsSync(commit)) {
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      env: gitEnv(),
      encoding: "utf8",
    });
    writeFileSync(commit, head.stdout);
  }
}

// The Intermediate Lessons again, with the Work folder in a repository of
// the Learner's own (learn-intermediate-rework): the replayed project/ is
// committed there, and every beat looks in it. Whether each result names
// the folder it ran in (BeatView.ranIn) waits on ticket 285.
for (const id of ORDER.filter((l) => /^i-\d$/.test(l)))
  test(`walk ${id} with a Work folder in another repository @walk`, async ({
    page,
  }) => {
    const previous = lessonsBefore(id).at(-1);
    const copy = practiceCopy(
      previous === undefined ? {} : { through: previous },
    );
    try {
      copy.apply(id);
      const repo = copy.repo("own");
      cpSync(join(copy.dir, "project"), repo, { recursive: true });
      for (const args of [
        ["add", "-A"],
        ["commit", "-q", "-m", "The project, as the Lessons left it"],
      ]) {
        const run = spawnSync("git", args, {
          cwd: repo,
          env: gitEnv(),
          encoding: "utf8",
        });
        if (run.status !== 0) throw new Error(`git failed: ${run.stderr}`);
      }
      // What the replay saved names the Practice copy's project/: the same
      // records, made in this repository, name it and its own commit.
      ownRecords(join(copy.dir, "project"), repo);
      const save = JSON.parse(saveBefore(id, { intermediate: repo })) as {
        missed: string[];
      };
      const skill = warmupSkill(id);
      if (skill !== null) save.missed = [skill];
      copy.write(".practice/learn.json", JSON.stringify(save));
      const taken = takeOutFresh(id, repo);
      const frames = await recordFrames(page);
      await copy.start();
      await arrive(page, copy, id);
      const beats = await walkLesson(page, copy, id, frames, {
        taken,
        folder: repo,
        onScreen: holdsScreen,
      });
      expect(
        expectedBeats(id).filter(
          (key) => !beats.has(key) && !(key in UNREACHED),
        ),
      ).toEqual([]);
      await expect(page).toHaveURL(new RegExp(`#/lesson/${id}/complete$`));
    } finally {
      await copy.dispose();
    }
  });

test("walk tables: every STAGE and UNREACHED key is a beat of the course", () => {
  const all = new Set(ORDER.flatMap((id) => expectedBeats(id)));
  expect(
    [...Object.keys(STAGE), ...Object.keys(UNREACHED)].filter(
      (key) => !all.has(key),
    ),
  ).toEqual([]);
});

test("walk beats: the walk's beat keys match the course's step files", () => {
  // An independent read of course/steps/<id>.md: each step heading, and
  // its "- beat:" lines up to the next heading.
  for (const id of ORDER) {
    const text = readFileSync(
      join(repoRoot, "course/steps", `${id}.md`),
      "utf8",
    );
    const keys: string[] = [];
    let step: string | null = null;
    let n = 0;
    for (const line of text.split("\n")) {
      const head = /^### ([WYTDCR]\d*) \|/.exec(line);
      if (head !== null) [step, n] = [head[1] ?? null, 0];
      else if (line.startsWith("### ")) step = null;
      else if (step !== null && line.startsWith("- beat:")) {
        keys.push(beatKey(id, step, n));
        n += 1;
      }
    }
    expect(expectedBeats(id)).toEqual(keys);
  }
});
