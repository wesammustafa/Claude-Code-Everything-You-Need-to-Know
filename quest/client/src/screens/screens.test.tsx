import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { OverviewLesson, Snapshot } from "@quest/contract";
import {
  complete,
  completed,
  courseDone,
  fullCourse,
  overview,
  overviewAt,
  playing,
  snapshotOf,
  someMastery,
  stepDown,
  stepDownGuided,
} from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";
import { WAITING_LINE } from "./Welcome";

// The app's own words on the slice's screens. Any other text must be a
// quote from the snapshot (Copy rules): a word about Claude Code is never
// the app's.
const APP_WORDS: readonly RegExp[] = [
  /^Hi Sam!$/,
  /^Learn Claude Code by using it\.$/,
  /^Every lesson happens in a real project, your Practice copy, with this page beside your terminal\.$/,
  /^This page$/,
  /^shows one step at a time and checks your work as you go$/,
  /^Your terminal$/,
  /^is the other window: each step says what to do there$/,
  /^Start the first lesson$/,
  /^See all three levels first$/,
  /^Welcome back\.$/,
  /^Continue$/,
  /^Step \d+ of \d+$/,
  /^Step \d+, .+: (done|current|to do)$/,
  /^Beginner · (Lesson \d+|Capstone)( · Step \d+ of \d+)?$/,
  /^After this lesson you can$/,
  /^Help by part of the lesson$/,
  /^(Guided|Hinted|Challenge|Every command shown|With hints|On your own)$/,
  /^(Start|Resume|Start with less help|Read the full lesson)$/,
  /^(Watching your Practice copy\.|Checking your work\.|That step is done\.)$/,
  /^Not yet\. The lines below say what the check saw\.$/,
  /^(Passes|Not yet|Checking): $/,
  /^(Check again|I've done it|Next step|Back|Skip|Show a hint|Another hint|Copy|Copied)$/,
  /^Less help from here$/,
  /^(Go on with hints|Go on on your own|Keep every command shown)$/,
  /^to$/,
  /^Lesson \d+ complete$/,
  /^\d+ of \d+ lines pass$/,
  /^You practised$/,
  /^A notch harder: it starts with less help\.$/,
  /^You did every task without the exact command\.$/,
  /^Questions about anything in this level\? Ask Claude Code, then compare the answer with the lesson pages\.$/,
  /^Compare with a reference solution$/,
  /^New badge: .+$/,
  /^Next: $/,
  /^Back to the learning journey$/,
  /^New badge$/,
  /^You already earned this badge\.$/,
  /^Explorer(, not yet)?$/,
  /^Not yet$/,
  /^(Beginner|Intermediate|Advanced) · (Lesson \d+|Capstone)$/,
  /^Open this lesson$/,
  /^(Claude Code Quest|Journey|Progress|Steps|Your card)$/,
  /^Electives$/,
  /^Learning journey$/,
  /^Three levels\. Each lesson ends with a check you can also run yourself\.$/,
  /^(Beginner|Intermediate|Advanced)$/,
  /^\d+ of \d+$/,
  /^Next$/,
  /^(Beginner|Intermediate|Advanced), (Lesson \d+|Capstone): $/,
  /^(Lesson \d+|Capstone)$/,
  /^What the check looks for$/,
  /^, (1 check|\d+ checks)$/,
  /^Not found on your PATH:$/,
  /^Open $/,
  /^ first$/,
  /^(Start over|Keep my place)$/,
  /^Start this lesson over\? Your Badge and the help you used are kept\.$/,
  /^(Skills|Next goal|Badges|lessons done|levels done)$/,
  /^The help you used shows here once you finish a step\.$/,
  /^(Every lesson is complete|See the journey)$/,
  /^Only what your checks verified counts here\.$/,
];

/** Every string the snapshot carries, to match quotes against. */
function quotes(snapshot: Snapshot): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value, value.replaceAll("`", ""));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  };
  walk(snapshot);
  return out;
}

/** The text on screen that is neither the app's own words nor a quote. */
function unquoted(snapshot: Snapshot): string[] {
  const from = quotes(snapshot);
  // The screen, its action bar and the top bar.
  const roots = [
    document.querySelector("[data-screen]"),
    document.querySelector("[data-action-bar]"),
    document.querySelector("[data-top] > header"),
  ].filter((root) => root !== null);
  const found: string[] = [];
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (text.trim() === "") continue;
      if (node.parentElement?.closest("[aria-hidden='true'], svg, title"))
        continue;
      if (APP_WORDS.some((word) => word.test(text))) continue;
      if (from.some((quote) => quote.includes(text.trim()))) continue;
      found.push(text);
    }
  }
  return found;
}

describe("Welcome", () => {
  test("a first run greets by first name and starts the course's next Lesson", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/",
      snapshotOf(overview, { welcomed: false }),
    );
    expect(screen.getByText("Hi Sam!")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Learn Claude Code by using it.",
      }),
    ).toBeInTheDocument();
    expect(unquoted(snapshotOf(overview))).toEqual([]);
    const held = page.hold();
    await user.click(
      screen.getByRole("button", { name: "Start the first lesson" }),
    );
    const start = screen.getByRole("button", {
      name: "Start the first lesson",
    });
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(start).toHaveAttribute("data-pending");
    await user.click(start);
    expect(page.posts).toEqual([{ type: "welcome.finish" }]);
    page.answer(snapshotOf(overview, { revision: 2, welcomed: true }));
    await held.release();
    await waitFor(() => {
      expect(page.router.state.location.pathname).toBe("/lesson/b-1");
    });
  });

  test("no greeting without a name", () => {
    renderConnected("/", snapshotOf(overview, { name: null }));
    expect(screen.queryByText(/^Hi /)).not.toBeInTheDocument();
  });

  test("the waiting line shows before the first snapshot", () => {
    renderConnected("/", null);
    expect(screen.getByText(WAITING_LINE)).toBeInTheDocument();
  });

  test("a return mid-Lesson shows the resume card, and Continue reopens the step", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/", snapshotOf(playing));
    const card = screen.getByRole("region", { name: "Where you left off" });
    expect(within(card).getByText("Step 11 of 11")).toBeInTheDocument();
    expect(within(card).getByRole("progressbar")).toBeInTheDocument();
    expect(unquoted(snapshotOf(playing))).toEqual([]);
    await user.click(within(card).getByRole("button", { name: "Continue" }));
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-1" }]);
    await waitFor(() => {
      expect(page.router.state.location.pathname).toBe("/lesson/b-1/step");
    });
  });
});

/** An overview with ticket 283's check items. */
function withCheck(lesson: OverviewLesson, check: string[]): OverviewLesson {
  return { ...lesson, check } as OverviewLesson;
}

describe("Lesson overview", () => {
  test("quotes the Lesson and starts it as planned or with less help", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1", snapshotOf(overview));
    expect(
      screen.getByRole("heading", { level: 1, name: overview.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("about 20 minutes")).toBeInTheDocument();
    for (const can of overview.intro?.can ?? [])
      expect(screen.getAllByText(can).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", { name: "Explorer, not yet" }),
    ).toBeInTheDocument();
    // b-1's fixture carries no check items, so no Disclosure.
    expect(
      screen.queryByText("What the check looks for"),
    ).not.toBeInTheDocument();
    expect(unquoted(snapshotOf(overview))).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Start with less help" }),
    );
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(page.posts).toEqual([
      { type: "lesson.start", help: "less" },
      { type: "lesson.start", help: "planned" },
    ]);
  });

  test("no Start while the folder question waits, and Resume for a saved place", () => {
    const page = renderConnected(
      "/lesson/b-1",
      snapshotOf({ ...overview, start: null }),
    );
    expect(
      screen.queryByRole("button", { name: /^Start/ }),
    ).not.toBeInTheDocument();
    page.send(snapshotOf({ ...overview, resumable: true }, { revision: 2 }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  test("what the check looks for shows closed, with the course's items", async () => {
    const user = userEvent.setup();
    const check = ["`notes.md` names the model", "the claim is corrected"];
    renderConnected("/lesson/b-1", snapshotOf(withCheck(overview, check)));
    const details = document.querySelector("main details");
    expect(details).not.toHaveAttribute("open");
    await user.click(screen.getByText("What the check looks for"));
    expect(details).toHaveAttribute("open");
    expect(details?.querySelectorAll("li")).toHaveLength(2);
  });

  test("a missing command names itself, and an unmet note offers its Lesson first", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/b-1",
      snapshotOf({
        ...overview,
        notes: [
          { kind: "need", quote: "You need `jq` installed.", missing: ["jq"] },
          { kind: "unmet", line: "", lesson: null },
          {
            kind: "unmet",
            line: "Lesson 2's plan is not there.",
            lesson: "b-2",
          },
        ],
        start: { planned: true, less: true, first: "b-2" },
      }),
    );
    const notes = document.querySelectorAll("[data-overview-notes] > li");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveTextContent("Not found on your PATH: jq");
    const offer = within(notes[1] as HTMLElement).getByRole("button", {
      name: "Open Permission modes and plan mode first",
    });
    await user.click(offer);
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-2" }]);
  });

  test("Start over is only for a saved place, and asks first", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1", snapshotOf(overview));
    expect(
      screen.queryByRole("button", { name: "Start over" }),
    ).not.toBeInTheDocument();
    page.send(snapshotOf({ ...overview, resumable: true }, { revision: 2 }));
    const trigger = screen.getByRole("button", { name: "Start over" });
    await user.click(trigger);
    const ask = screen.getByRole("group", { name: "Start over" });
    expect(
      within(ask).getByRole("button", { name: "Keep my place" }),
    ).toHaveFocus();
    await user.click(
      within(ask).getByRole("button", { name: "Keep my place" }),
    );
    expect(page.posts).toEqual([]);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start over" })).toHaveFocus();
    expect(page.posts).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(
      within(screen.getByRole("group", { name: "Start over" })).getByRole(
        "button",
        { name: "Start over" },
      ),
    );
    expect(page.posts).toEqual([{ type: "lesson.restart", lesson: "b-1" }]);
    // The restart lands: Start over goes, and focus moves to Start.
    page.send(snapshotOf(overview, { revision: 3 }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
  });

  test("the Work folder question: asking with no Start, then the answer with Change", async () => {
    const user = userEvent.setup();
    const q = (
      over: Partial<NonNullable<OverviewLesson["folderQuestion"]>>,
    ) => ({
      key: "intermediate",
      asks: "work" as const,
      current: null,
      problem: null,
      open: true,
      checking: false,
      ...over,
    });
    const i1 = overviewAt("i-1");
    const page = renderConnected(
      "/lesson/i-1",
      snapshotOf(
        { ...i1, folderQuestion: q({}), start: null },
        { course: fullCourse },
      ),
    );
    const slot = screen.getByRole("region", { name: "Work folder" });
    expect(slot).toHaveAttribute("data-folder-question");
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    page.send(
      snapshotOf(
        {
          ...i1,
          folderQuestion: q({ current: "/home/sam/practice", open: false }),
        },
        { course: fullCourse, revision: 2 },
      ),
    );
    expect(slot).toHaveTextContent("Work folder: this practice copy");
    // The answer taken: Start appears and takes focus.
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
    page.send(
      snapshotOf(
        { ...i1, folderQuestion: q({ current: "/home/sam/app", open: false }) },
        { course: fullCourse, revision: 3 },
      ),
    );
    expect(
      screen.getByRole("region", { name: "Work folder" }),
    ).toHaveTextContent("Work folder: /home/sam/app");
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(page.posts).toEqual([{ type: "folder.ask", key: "intermediate" }]);
    // Editing a saved answer can be left with Cancel.
    page.send(
      snapshotOf(
        { ...i1, folderQuestion: q({ current: "/home/sam/app" }) },
        { course: fullCourse, revision: 4 },
      ),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(page.posts.at(-1)).toEqual({ type: "folder.cancel" });
  });

  test("a-5 asks for its new copy with the path field alone; i-capstone has no slot", () => {
    const page = renderConnected(
      "/lesson/a-5",
      snapshotOf(
        {
          ...overviewAt("a-5"),
          folderQuestion: {
            key: "a-5",
            asks: "new-copy",
            current: null,
            problem: null,
            open: true,
            checking: false,
          },
          start: null,
        },
        { course: fullCourse },
      ),
    );
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    page.send(
      snapshotOf(
        { ...overviewAt("i-capstone"), folderQuestion: null },
        { course: fullCourse, revision: 2 },
      ),
    );
    page.router.navigate("/lesson/i-capstone").catch(() => undefined);
    expect(document.querySelector("[data-folder-question]")).toBeNull();
  });

  test("each Work folder problem is worded, and the changed note keeps its words", () => {
    renderConnected(
      "/lesson/i-1",
      snapshotOf(
        {
          ...overviewAt("i-1"),
          notes: [
            { kind: "changed" },
            ...(["missing", "gitBroken", "notGit", "noPractice"] as const).map(
              (problem) => ({ kind: "folder-problem" as const, problem }),
            ),
          ],
        },
        { course: fullCourse },
      ),
    );
    const notes = within(
      document.querySelector("[data-overview-notes]") as HTMLElement,
    ).getAllByRole("listitem");
    expect(notes.map((n) => n.textContent)).toEqual([
      "This lesson changed since you started it, so it starts again here.",
      "The work folder is not there any more. Choose it again, or choose another.",
      "Git could not look at the work folder, so its checks cannot run yet. Check that git works in your terminal.",
      "The work folder is not a git repository. Run git init there, or choose another folder.",
      "Git does not ignore .practice/ in the work folder. Add .practice/ to its .gitignore, so your practice files stay out of your commits.",
    ]);
  });

  test("a rich overview uses only course fields for its Claude Code words", async () => {
    const user = userEvent.setup();
    const rich = withCheck(
      {
        ...overview,
        intro: overview.intro && {
          ...overview.intro,
          can: [
            ...overview.intro.can,
            "read **every** line of [the docs](https://code.claude.com/docs/en/overview)",
          ],
        },
        notes: [
          { kind: "need", quote: "You need `jq` installed.", missing: ["jq"] },
          { kind: "win-note", text: "" },
          {
            kind: "unmet",
            line: "Lesson 2's plan is not there.",
            lesson: "b-2",
          },
        ],
        start: { planned: true, less: true, first: "b-2" },
        resumable: true,
      },
      ["`notes.md` names the model"],
    );
    renderConnected("/lesson/b-1", snapshotOf(rich));
    await user.click(screen.getByText("What the check looks for"));
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(
      screen.getByRole("group", { name: "Start over" }),
    ).toBeInTheDocument();
    expect(unquoted(snapshotOf(rich))).toEqual([]);
  });
});

describe("Lesson workspace", () => {
  test("shows the step from the snapshot, its check lines and the Not yet line", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(playing));
    expect(
      screen.getByRole("heading", { level: 1, name: "Check" }),
    ).toBeInTheDocument();
    expect(document.querySelector("main code")).toHaveTextContent(
      "npm run check -- b-1",
    );
    expect(
      document.querySelectorAll("[data-pip-target='lines'] li").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/The note still says/)).toBeInTheDocument();
    expect(unquoted(snapshotOf(playing))).toEqual([]);
  });

  test("Check again posts check.run once, however often it is pressed while in flight", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(playing));
    const held = page.hold();
    const check = screen.getByRole("button", { name: "Check again" });
    await user.click(check);
    expect(check).toHaveAttribute("aria-disabled", "true");
    expect(check).toHaveAttribute("data-pending");
    await user.click(check);
    expect(check).toHaveFocus();
    expect(page.posts).toEqual([{ type: "check.run" }]);
    await held.release();
    expect(check).not.toHaveAttribute("aria-disabled");
  });

  test("a done beat goes on with Next step; a self beat says it is done", async () => {
    const user = userEvent.setup();
    const beat = playing.beat;
    if (beat === null) throw new Error("the fixture has a beat");
    const done = {
      ...playing,
      beat: { ...beat, status: "done" as const, fail: null },
    };
    const page = renderConnected("/lesson/b-1/step", snapshotOf(done));
    await user.click(screen.getByRole("button", { name: "Next step" }));
    const self = {
      ...playing,
      beat: {
        ...beat,
        kind: "self" as const,
        status: "waiting" as const,
        verification: [],
        fail: null,
        self: "Self-check (not tested): you can say which model it was.",
      },
    };
    page.send(snapshotOf(self, { revision: 2 }));
    await user.click(screen.getByRole("button", { name: "I've done it" }));
    expect(page.posts).toEqual([
      { type: "step.continue" },
      { type: "step.markDone" },
    ]);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(page.posts.at(-1)).toEqual({ type: "step.revisit" });
    expect(
      screen.queryByRole("button", { name: "Skip" }),
    ).not.toBeInTheDocument();
  });

  test("a hint opens through hint.next and shows the engine's words", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(playing));
    await user.click(screen.getByRole("button", { name: "Show a hint" }));
    expect(page.posts).toEqual([{ type: "hint.next" }]);
    page.send(
      snapshotOf(
        {
          ...playing,
          hints: {
            ...playing.hints,
            shown: [
              {
                kind: "check",
                text: "Does the corrected claim state the exit code?",
              },
            ],
            available: false,
          },
        },
        { revision: 2 },
      ),
    );
    expect(
      screen.getByText("Does the corrected claim state the exit code?"),
    ).toBeInTheDocument();
  });

  test("a Step-down offers its choices", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(stepDown));
    expect(
      screen.getByRole("heading", { level: 1, name: "Less help from here" }),
    ).toBeInTheDocument();
    expect(unquoted(snapshotOf(stepDown))).toEqual([]);
    expect(
      screen.queryByRole("button", { name: /^Keep / }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go on on your own" }));
    expect(page.posts).toEqual([{ type: "stepDown.accept" }]);
  });

  test("Guided to Hinted offers going on with hints or keeping every command", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/b-1/step",
      snapshotOf(stepDownGuided),
    );
    expect(unquoted(snapshotOf(stepDownGuided))).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Go on with hints" }));
    await user.click(
      screen.getByRole("button", { name: "Keep every command shown" }),
    );
    expect(page.posts).toEqual([
      { type: "stepDown.accept" },
      { type: "stepDown.moreHelp" },
    ]);
  });

  test("a Step-down's Back goes back", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(stepDown));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(page.posts).toEqual([{ type: "stepDown.back" }]);
  });

  test.each([
    ["Guided to Hinted", stepDownGuided, "Guided", "Hinted"],
    ["Hinted to Challenge", stepDown, "Hinted", "Challenge"],
  ] as const)(
    "%s shows both tiers where Pip looks, and never says level up",
    (_, lesson, from, to) => {
      renderConnected("/lesson/b-1/step", snapshotOf(lesson));
      const tiers = document.querySelector("[data-pip-target=tiers]");
      expect(tiers).not.toBeNull();
      expect(tiers?.textContent).toContain(from);
      expect(tiers?.textContent).toContain(to);
      expect(document.body.textContent).not.toMatch(/level.?up/i);
    },
  );

  test("a new step or a Step-down on the same route moves focus to its heading", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(playing));
    await user.click(screen.getByRole("button", { name: "Show a hint" }));
    page.send(snapshotOf(stepDown, { revision: 2 }));
    const down = screen.getByRole("heading", {
      level: 1,
      name: "Less help from here",
    });
    expect(down).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Go on on your own" }));
    const beat = playing.beat;
    if (beat === null) throw new Error("the fixture has a beat");
    page.send(
      snapshotOf(
        { ...playing, beat: { ...beat, index: beat.index + 1 } },
        { revision: 3 },
      ),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  test("a screen still waiting for its snapshot takes focus when it arrives", async () => {
    const page = renderConnected("/", snapshotOf(overview));
    await act(async () => {
      await page.router.navigate("/lesson/b-1/step");
    });
    page.send(snapshotOf(playing, { revision: 2 }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });
  });
});

describe("Lesson complete", () => {
  test("reveals the Badge once, for the tab that wins its milestone", async () => {
    const page = renderConnected(
      "/lesson/b-1/complete",
      snapshotOf(complete, { milestones: completed }),
    );
    expect(screen.getByText("Lesson 1 complete")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 lines pass")).toBeInTheDocument();
    expect(screen.getAllByText("Every command shown").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("button", { name: /Next: Permission modes/ }),
    ).toBeInTheDocument();
    expect(unquoted(snapshotOf(complete))).toEqual([]);
    await waitFor(() => {
      expect(page.posts).toEqual([
        { type: "milestone.shown", id: completed[0]?.id },
      ]);
    });
    expect(await screen.findByText("New badge")).toBeInTheDocument();
  });

  test("a completion with no pending milestone shows the Badge earned, not revealed", () => {
    const page = renderConnected("/lesson/b-1/complete", snapshotOf(complete));
    expect(screen.getByRole("img", { name: "Explorer" })).toBeInTheDocument();
    expect(screen.queryByText("New badge")).not.toBeInTheDocument();
    expect(page.posts).toEqual([]);
  });

  test("a replay says the Badge is already earned", () => {
    const replay = { ...complete, firstTime: false };
    renderConnected("/lesson/b-1/complete", snapshotOf(replay));
    expect(
      screen.getByText("You already earned this badge."),
    ).toBeInTheDocument();
    expect(unquoted(snapshotOf(replay))).toEqual([]);
  });
});

describe("Learning journey", () => {
  test("every word on it, and on the top bar, is the app's or the course's", () => {
    const at = snapshotOf(overviewAt("b-4"), {
      welcomed: true,
      course: fullCourse,
    });
    renderConnected("/journey", at);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(unquoted(at)).toEqual([]);
  });

  test("a Lesson's preview and its top bar quote the course", () => {
    const at = snapshotOf(overviewAt("b-4"), {
      welcomed: true,
      course: fullCourse,
    });
    renderConnected("/lesson/i-2", at);
    expect(screen.getByText("Intermediate · Lesson 2")).toBeInTheDocument();
    expect(unquoted(at)).toEqual([]);
  });
});

describe("Progress", () => {
  const at = (mastery = {}) =>
    snapshotOf(overviewAt("b-4"), {
      welcomed: true,
      course: fullCourse,
      mastery,
    });
  const skills = () => screen.getByRole("region", { name: "Skills" });

  test("with no Mastery yet: completion at once, no skill rows", () => {
    const snapshot = at();
    renderConnected("/progress", snapshot);
    expect(screen.getByText("3 of 23")).toBeInTheDocument();
    expect(screen.getByText("0 of 3")).toBeInTheDocument();
    expect(within(skills()).queryAllByRole("listitem")).toEqual([]);
    expect(skills().querySelector("[data-tier]")).toBeNull();
    expect(skills().textContent).not.toMatch(/On your own|\d/);
    expect(
      within(screen.getByRole("main")).queryByRole("progressbar"),
    ).toBeNull();
    expect(unquoted(snapshot)).toEqual([]);
  });

  test("each skill's row says the help last used, in course order", () => {
    renderConnected("/progress", at(someMastery));
    const rows = within(skills()).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "installEvery command shown",
      "askOn your own",
      "exitWith hints",
    ]);
    expect(skills().textContent).not.toMatch(/\d/);
    expect(screen.getByText("3 of 23")).toBeInTheDocument();
    expect(screen.getByText("0 of 3")).toBeInTheDocument();
  });

  test("every Badge by Level, earned or not yet", () => {
    renderConnected("/progress", at());
    const box = screen.getByRole("region", { name: "Badges" });
    const badges = within(box).getAllByRole("img");
    expect(badges).toHaveLength(23);
    const names = badges.map((b) => b.getAttribute("aria-label") ?? "");
    expect(names.filter((n) => !n.endsWith(", not yet"))).toEqual([
      "Explorer",
      "Planner",
      "Builder",
    ]);
    expect(names.filter((n) => n.endsWith(", not yet"))).toHaveLength(20);
    expect(
      within(box)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Beginner", "Intermediate", "Advanced"]);
  });

  test("the goal links to the open Lesson's path", () => {
    renderConnected("/progress", at());
    const goal = screen.getByRole("region", { name: "Next goal" });
    expect(goal.textContent).toContain("Beginner, Lesson 4: ");
    expect(within(goal).getByRole("link", { name: "Start" })).toHaveAttribute(
      "href",
      "/lesson/b-4",
    );
  });

  test("the goal opens the course's next Lesson with lesson.open", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/progress",
      snapshotOf(complete, { welcomed: true, course: fullCourse }),
    );
    const goal = screen.getByRole("region", { name: "Next goal" });
    await user.click(within(goal).getByRole("button", { name: "Start" }));
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-4" }]);
  });

  test("a finished course points to the journey and keeps Pip's target", () => {
    renderConnected(
      "/progress",
      snapshotOf(complete, { welcomed: true, course: courseDone }),
    );
    const goal = screen.getByRole("region", { name: "Next goal" });
    expect(goal).toHaveAttribute("data-pip-target", "goal");
    expect(goal.textContent).toContain("Every lesson is complete");
    expect(
      within(goal).getByRole("link", { name: "See the journey" }),
    ).toHaveAttribute("href", "/journey");
  });

  test("no score, rank, XP or streak", () => {
    renderConnected("/progress", at(someMastery));
    expect(screen.getByRole("main").textContent).not.toMatch(
      /score|rank|\bXP\b|streak|points/i,
    );
  });
});

describe("the engine owns the place", () => {
  test("the path follows the phase, replacing the entry", async () => {
    const page = renderConnected("/lesson/b-1", snapshotOf(overview));
    page.send(snapshotOf(playing, { revision: 2 }));
    await waitFor(() => {
      expect(page.router.state.location.pathname).toBe("/lesson/b-1/step");
    });
    expect(page.router.state.historyAction).toBe("REPLACE");
    page.send(snapshotOf(complete, { revision: 3 }));
    await waitFor(() => {
      expect(page.router.state.location.pathname).toBe("/lesson/b-1/complete");
    });
  });

  test("a route to another Lesson shows its preview and posts nothing", async () => {
    const page = renderConnected("/lesson/b-2", snapshotOf(complete));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Permission modes and plan mode",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Beginner · Lesson 2")).toBeInTheDocument();
    expect(screen.getByText("about 25 minutes")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Planner, not yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the learning journey" }),
    ).toHaveAttribute("href", "/journey");
    page.send(snapshotOf(complete, { revision: 2 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(page.posts).toEqual([]);
    expect(page.router.state.location.pathname).toBe("/lesson/b-2");
  });

  test("Open this lesson posts one lesson.open and follows the phase", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-2", snapshotOf(complete));
    const b2 = {
      ...overview,
      id: "b-2",
      title: "Permission modes and plan mode",
    };
    page.answer(snapshotOf(b2, { revision: 2, welcomed: true }));
    await user.click(screen.getByRole("button", { name: "Open this lesson" }));
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-2" }]);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Permission modes and plan mode",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-lesson-preview]")).toBeNull();
    expect(page.router.state.location.pathname).toBe("/lesson/b-2");
  });

  test("Lesson complete's Next posts lesson.open for the next Lesson", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/complete", snapshotOf(complete));
    await user.click(
      screen.getByRole("button", { name: /Next: Permission modes/ }),
    );
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-2" }]);
  });

  test("a resume with no beat open asks to open it; an unknown id is NotFound", async () => {
    const waiting = { ...playing, step: null, beat: null };
    const page = renderConnected("/lesson/b-1/step", snapshotOf(waiting));
    await waitFor(() => {
      expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-1" }]);
    });
    await act(async () => {
      await page.router.navigate("/lesson/z-9");
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Nothing here" }),
    ).toBeInTheDocument();
  });

  test("a snapshot with only its header shows a quiet screen, not an error", () => {
    renderConnected("/lesson/b-1/step", {
      instance: "e2e",
      revision: 1,
      milestones: [],
    } as unknown as Snapshot);
    expect(document.querySelector("[data-lesson-waiting]")).not.toBeNull();
  });
});
