// The verify-kind matrix (246 AC1): for each kind, a fresh Practice copy
// with the Reference solutions replayed through the Lesson
// (practice-copy.ts `through`), a save that opens it next, and the step's
// waiting, Not yet and passed states on the real engine, host and server.
// One copy per row; the replay puts the Lesson's work in place, `hide` takes
// the step's part back out before the app starts, `notYet` makes the Check
// see something wrong, and `show` puts it right.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  KEY_NAMES,
  actionsOf,
  bar,
  checkAgainOn,
  heading,
  saveAt,
} from "./play.ts";
import { practiceCopy, type PracticeCopy } from "./practice-copy.ts";

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 1280, height: 900 } });
// Copying the template, replaying the Lessons and starting the app.
test.setTimeout(120_000);

interface Row {
  kind: string;
  lesson: string;
  /** The step's title, as its heading reads. */
  step: string;
  /** The step's id and the beat's place in it, from 0, as the save keeps them. */
  at: [string, number];
  /** Before the app starts: takes the step's own work back out. */
  hide?: (copy: PracticeCopy) => void;
  /** On the beat: makes the next look see something wrong. */
  notYet?: (copy: PracticeCopy) => void;
  /** Puts it right. */
  show: (copy: PracticeCopy) => void;
  /** The Not yet line's words. */
  says: RegExp;
  /** The first look passes: no Not yet to reach on a real copy. */
  passesOnArrival?: true;
  /** A watched beat looks again by itself; a Check waits for Check again. */
  looks: "check" | "watch";
}

const write = (copy: PracticeCopy, path: string, text: string) => {
  copy.write(`project/${path}`, text);
};
const remove = (copy: PracticeCopy, path: string) => {
  rmSync(join(copy.dir, "project", path), { force: true });
};

const NAMED_SKILL =
  "---\nname: five-whys\ndescription: Ask why five times.\n---\n";
const HOOK =
  '{"hooks":{"InstructionsLoaded":[{"hooks":[{"type":"command","command":"true"}]}]}}\n';

const ROWS: Row[] = [
  {
    kind: "check",
    lesson: "b-2",
    step: "Record the plan moment",
    at: ["Y4", 0],
    // The replayed save is there but not fresh: the item passes, the beat waits.
    notYet: (copy) => {
      remove(copy, ".practice/b-2-before.txt");
    },
    show: (copy) => {
      write(copy, ".practice/b-2-before.txt", "");
    },
    says: /While the plan is on screen/,
    looks: "check",
  },
  {
    kind: "file fresh",
    lesson: "b-2",
    step: "Record the plan moment",
    at: ["Y4", 1],
    notYet: (copy) => {
      remove(copy, ".practice/b-2-plan.txt");
    },
    show: (copy) => {
      write(
        copy,
        ".practice/b-2-plan.txt",
        "src/config.js\ntest/config.test.js\n",
      );
    },
    says: /b-2-plan\.txt/,
    looks: "watch",
  },
  {
    kind: "git-clean",
    lesson: "b-3",
    step: "Explore the parser",
    at: ["W1", 0],
    hide: (copy) => {
      write(copy, "scratch.txt", "left over\n");
    },
    show: (copy) => {
      remove(copy, "scratch.txt");
    },
    says: /scratch\.txt|commit/i,
    looks: "watch",
  },
  {
    kind: "match",
    lesson: "i-1",
    step: "Download a skill and read it",
    at: ["W1", 0],
    notYet: (copy) => {
      write(
        copy,
        ".claude/skills/five-whys/SKILL.md",
        "---\nname: other\n---\n",
      );
    },
    show: (copy) => {
      write(copy, ".claude/skills/five-whys/SKILL.md", NAMED_SKILL);
    },
    says: /five-whys/,
    looks: "watch",
  },
  {
    kind: "no-match",
    lesson: "i-1",
    step: "Choose the trigger",
    at: ["Y2", 0],
    notYet: (copy) => {
      write(
        copy,
        ".claude/skills/tdd/SKILL.md",
        "---\ndescription: TODO\n---\n",
      );
    },
    show: (copy) => {
      write(
        copy,
        ".claude/skills/tdd/SKILL.md",
        "---\nname: tdd\ndescription: Test first. Use when adding a feature.\n---\n",
      );
    },
    says: /TODO/,
    looks: "watch",
  },
  {
    kind: "json",
    lesson: "i-2",
    step: "Save the load log",
    at: ["W3", 0],
    notYet: (copy) => {
      write(copy, ".practice/i-2-hook.json", "{}\n");
    },
    show: (copy) => {
      write(copy, ".practice/i-2-hook.json", HOOK);
    },
    says: /i-2-hook\.json/,
    looks: "watch",
  },
  {
    kind: "git-staged",
    lesson: "i-3",
    step: "Run it on a staged change",
    at: ["Y3", 0],
    show(copy) {
      write(copy, "NOTES.md", "A staged change.\n");
      copy.git("add", "NOTES.md");
    },
    says: /stag/i,
    looks: "watch",
  },
  {
    kind: "git-changed",
    lesson: "a-6",
    step: "Download the example marketplace",
    at: ["W1", 0],
    show: (copy) => {
      write(copy, "team-marketplace/README.md", "# Team marketplace\n");
    },
    says: /team-marketplace/,
    looks: "watch",
  },
  {
    kind: "head-moved",
    lesson: "i-8",
    step: "Confirm the server, then use it on a real change",
    at: ["W3", 2],
    show(copy) {
      write(copy, "NOTES.md", "A small change.\n");
      copy.git("add", "NOTES.md");
      copy.git("commit", "-q", "-m", "Make a small change");
    },
    says: /commit/i,
    looks: "watch",
  },
  {
    kind: "git-unchanged",
    lesson: "a-3",
    step: "Run it by name on a second folder",
    at: ["Y5", 1],
    // Its baseline is git status as the step opens, so the first look
    // passes; a change between the opening and that look is a race (D20).
    passesOnArrival: true,
    show: () => undefined,
    says: /same paths/,
    looks: "watch",
  },
  {
    kind: "probe",
    lesson: "a-1",
    step: "Start the docs session",
    at: ["W2", 0],
    show: (copy) =>
      copy.git(
        "worktree",
        "add",
        "-q",
        ".claude/worktrees/docs-pass",
        // The replay merged and kept the branch.
        "worktree-docs-pass",
      ),
    says: /worktree/i,
    looks: "watch",
  },
];

/** The step card's Check lines. */
const lines = (page: Page) => page.locator("main [data-pip-target=lines] > li");

/** Records every state the card's Check lines show, in order. */
async function recordStates(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { seenStates: string[] }).seenStates = seen;
    // On Linux the first look can finish, and its frame reach the store,
    // before React commits the card for lesson.open's reply, which would
    // drop that reply's "checking" revision unseen. Snapshot frames that
    // come after lesson.open wait until the card's lines have shown once.
    let hold = false;
    const held: (() => void)[] = [];
    const release = () => {
      hold = false;
      for (const deliver of held.splice(0)) deliver();
    };
    const addHeld = function (
      this: EventSource,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type !== "snapshot" || listener === null) {
        EventTarget.prototype.addEventListener.call(
          this,
          type,
          listener,
          options,
        );
        return;
      }
      const call = (event: Event) => {
        if (typeof listener === "function") listener.call(this, event);
        else listener.handleEvent(event);
      };
      EventTarget.prototype.addEventListener.call(
        this,
        type,
        (event: Event) => {
          if (hold)
            held.push(() => {
              call(event);
            });
          else call(event);
        },
        options,
      );
    };
    window.EventSource.prototype.addEventListener =
      addHeld as typeof EventSource.prototype.addEventListener;
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (
        url.endsWith("/api/actions") &&
        typeof init?.body === "string" &&
        init.body.includes('"lesson.open"')
      )
        hold = true;
      return realFetch(input, init);
    };
    const look = () => {
      const items = document.querySelectorAll(
        "main [data-pip-target=lines] > li",
      );
      for (const li of items) {
        const state = li.getAttribute("data-state") ?? "";
        if (seen.at(-1) !== state) seen.push(state);
      }
      if (hold && items.length > 0) release();
    };
    new MutationObserver(look).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { seenStates: string[] }).seenStates,
    );
}

/** No text on the workspace names a key (D14), on the real course. */
async function namesNoKey(page: Page) {
  const text = await page.evaluate(() =>
    [
      document.querySelector("[data-says-bubble]"),
      document.querySelector("[data-action-bar]"),
    ]
      .map((root) => (root as HTMLElement | null)?.innerText ?? "")
      .join("\n"),
  );
  expect(text).not.toMatch(KEY_NAMES);
}

/** Welcome's Continue, to the saved step. */
async function openAt(page: Page, copy: PracticeCopy) {
  await page.goto(copy.url);
  await page.getByRole("button", { name: "Continue" }).click();
}

function folderFor(lesson: string, copy: PracticeCopy) {
  if (lesson.startsWith("i-")) return { intermediate: copy.dir };
  if (lesson.startsWith("a-")) return { advanced: copy.dir };
  return {};
}

for (const row of ROWS)
  test(`${row.kind}: ${row.lesson} "${row.step}" waits, ${
    row.passesOnArrival === true
      ? "passes on its first look"
      : "says Not yet, then passes"
  }`, async ({ page }) => {
    const copy = practiceCopy({ through: row.lesson });
    try {
      copy.write(
        ".practice/learn.json",
        saveAt(row.lesson, ...row.at, folderFor(row.lesson, copy)),
      );
      row.hide?.(copy);
      const seen = await recordStates(page);
      const sent = actionsOf(page);
      await copy.start();
      // The engine reports the first look as running in lesson.open's reply.
      const opened = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/actions") &&
          response.request().postData()?.includes('"lesson.open"') === true,
      );
      await openAt(page, copy);
      const reply = (await (await opened).json()) as {
        snapshot?: { lesson?: { beat?: { status?: string } } };
      };
      expect(reply.snapshot?.lesson?.beat?.status).toBe("checking");
      await expect(heading(page)).toHaveText(row.step);

      // Waiting: the line is waiting while the first look runs.
      await expect.poll(seen).toContain("waiting");
      await namesNoKey(page);

      const check = bar(page).getByRole("button", { name: "Check again" });
      if (row.passesOnArrival !== true) {
        // Not yet, with the Check's own words.
        row.notYet?.(copy);
        await check.click();
        const notYet = page.locator("main [data-state=not-yet]");
        await expect(notYet).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("main")).toContainText(row.says);
        await namesNoKey(page);

        // Passed, with what the Check saw, and Next step.
        row.show(copy);
        // The host's watcher can see the change and pass the beat before the
        // press lands; a press then would go to the next beat (254 D25), so
        // it is bound to this beat and its Not yet.
        if (row.looks === "check")
          await checkAgainOn(
            page,
            `${row.lesson}:${row.at[0]}:${String(row.at[1])}`,
            "fail",
            30_000,
          );
      } else {
        await expect(page.locator("main")).toContainText(row.says);
      }
      const next = bar(page).getByRole("button", { name: "Next step" });
      await expect(next).toBeVisible({ timeout: 30_000 });
      await expect(lines(page).last()).toHaveAttribute("data-state", "ok");
      await namesNoKey(page);

      // A verify beat is the engine's to pass: no step.markDone. A run in
      // the Practice copy itself says nothing about running it too.
      expect(sent.filter((a) => a.type === "step.markDone")).toHaveLength(0);
      if (row.lesson.startsWith("i-") || row.lesson.startsWith("a-"))
        await expect(page.locator("[data-ran-in]")).toHaveCount(0);
    } finally {
      await copy.dispose();
    }
  });

// Every verify kind a course beat uses has a row, so a dropped row or a
// new kind in the course cannot leave AC1 quietly unchecked. Learner and
// answer kinds have no Check to wait on; the screen tests cover them.
const NO_CHECK = new Set(["self", "answer", "none"]);
const usedKinds = (): string[] => {
  const kinds = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") {
      const verify = (value as { verify?: { kind?: unknown } }).verify;
      if (typeof verify?.kind === "string") kinds.add(verify.kind);
      Object.values(value).forEach(walk);
    }
  };
  walk(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../../engine/dist/course.json"),
        "utf8",
      ),
    ),
  );
  return [...kinds].filter((kind) => !NO_CHECK.has(kind)).sort();
};

test("the matrix has a row for every verify kind the course uses", () => {
  const rows = new Set(ROWS.map((row) => row.kind.split(" ")[0]));
  expect(usedKinds().filter((kind) => !rows.has(kind))).toEqual([]);
});

test('session: b-2 "Confirm no edit yet" waits for the session, says Not yet, then passes', async ({
  page,
}) => {
  const copy = practiceCopy({ through: "b-2" });
  try {
    copy.write(".practice/learn.json", saveAt("b-2", "W6", 0));
    write(copy, "scratch.txt", "an edit\n");
    const sent = actionsOf(page);
    await copy.start();
    await openAt(page, copy);
    await expect(heading(page)).toHaveText("Confirm no edit yet");
    const ended = bar(page).getByRole("button", {
      name: "it says nothing to commit",
    });
    await expect(page.locator("[data-says-words]")).toHaveText(
      "Waiting for the session to end.",
    );
    await namesNoKey(page);
    const count = (type: string) => sent.filter((a) => a.type === type).length;
    const before = count("session.ended");

    await ended.click();
    await expect(page.locator("[data-says-words]")).toContainText("Not yet", {
      timeout: 30_000,
    });
    expect(count("session.ended") - before).toBe(1);
    await namesNoKey(page);

    // Said again while the tree is still dirty: still Not yet. Said before
    // the edit goes, since a watched beat looks again by itself once the
    // tree changes, and the button then turns into Next step.
    await ended.click();
    await expect.poll(() => count("session.ended") - before).toBe(2);
    await expect(page.locator("[data-says-words]")).toContainText("Not yet");
    remove(copy, "scratch.txt");
    await expect(
      bar(page).getByRole("button", { name: "Next step" }),
    ).toBeVisible({ timeout: 30_000 });
    expect(count("session.ended") - before).toBe(2);
    expect(count("step.markDone")).toBe(0);
    await namesNoKey(page);
  } finally {
    await copy.dispose();
  }
});
