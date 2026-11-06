import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { OverviewLesson, PlayingLesson, Snapshot } from "@quest/contract";
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
  alreadyCodespace,
  checkBroken,
  checkRunning,
  checkSame,
  checkStale,
  codeWindow,
  course,
  learnerBeat,
  offersBoth,
  richCopy,
  sessionBeat,
  tearDown,
  watchChecking,
  watchNotYet,
  watchPassed,
  watchWaiting,
  workFolderCheck,
  askBeat,
  askRevealed,
  askRight,
  askWrong,
  challengeUnavailable,
  challengeUnavailableAnswer,
  confirmExact,
  exactTaken,
  predictBeat,
  typeBeat,
  typeWrong,
  waitQuestionAnswered,
  waitQuestionEnded,
  waitQuestionOpen,
  warmupAsk,
  warmupAskQuiet,
  whenOption,
} from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";
import FAILURES from "../../test/beginner-failures.json";
import { WAITING_LINE } from "./Welcome";

// The app's own words on the slice's screens. Any other text must be a
// quote from the snapshot (Copy rules): a word about Claude Code is never
// the app's.
const APP_WORDS: readonly RegExp[] = [
  /^Hi Ali!$/,
  /^Learn Claude Code by using it\.$/,
  /^Every lesson happens in a real project, your Practice copy, with this page beside your terminal\.$/,
  /^This page$/,
  /^shows one step at a time and checks your work as you go$/,
  /^Your terminal$/,
  /^is the other window: each step says what to do there$/,
  /^Start the first lesson$/,
  /^See all three levels( first)?$/,
  /^Continue: $/,
  /^Welcome back\.$/,
  /^Continue$/,
  /^Step \d+ of \d+$/,
  /^Step \d+, .+: (done|current|to do)$/,
  /^(Beginner|Intermediate|Advanced) · (Lesson \d+|Capstone)( · (Step|Tear down, step) \d+ of \d+)?$/,
  /^After this lesson you can$/,
  /^Help by part of the lesson$/,
  /^(Guided|Hinted|Challenge|Every command shown|With hints|On your own)$/,
  /^(Start|Resume|Start with less help|Read the full lesson)$/,
  /^(Watching your Practice copy\.|Checking your work\.|That step is done\.)$/,
  /^(Watching your Practice copy\.|Watching your work folder: .+\.) After the check runs in your terminal, choose Check again\.$/,
  /^(Check again runs these lines\.|Not yet\.)$/,
  /^Not yet\. The lines below say what the check saw\.$/,
  /^(Passes|Not yet|Checking): $/,
  /^(Check again|I've done it|Yes, I can|Next step|Back|Skip|Show a hint|Another hint|Copy|Copied)$/,
  /^Less help from here$/,
  /^(Go on with hints|Go on on your own|Keep every command shown)$/,
  /^to$/,
  /^Lesson \d+ complete$/,
  /^\d+ of \d+ lines pass$/,
  /^You practised$/,
  /^Beside each: the help on its latest step, counting any hint or exact command you opened\.$/,
  /^ · $/,
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
  /^Found on your PATH\.$/,
  /^Looking on your PATH\.\.\.$/,
  /^What you need$/,
  /^Open $/,
  /^ first$/,
  /^(Start over|Keep my place)$/,
  /^Start this lesson over\? Your Badge and the help you used are kept\.$/,
  /^(Skills|Next goal|Badges|lessons done|levels done)$/,
  /^The help you used shows here once you finish a step\.$/,
  /^(Every lesson is complete|See the journey)$/,
  /^Only what your checks verified counts here\.$/,
  // The workspace (246).
  /^(Passes|Not yet|Checking|Could not check): $/,
  /^(The check took too long this time\.|The check's answer could not be read this time\.|The check stopped before it finished\.|The check could not run this time\.)$/,
  /^The check saw the same as last time\. The cause may be in an earlier step\.$/,
  /^Nothing has changed there since this step opened\.$/,
  /^Everything else passes\. Check again runs the slow part\.$/,
  /^Checking( item \d+ of \d+| .+)?…$/,
  /^Already done, so this step counts\.$/,
  /^What the step asks for$/,
  /^(Back to |: |Why: |You should see: |Found |\.)$/,
  /^(The commands are in the hints\.|More help on this step\.|You ran this|Copy the code|explained line: )$/,
  /^The Check passed\. These steps put things back as they were\.$/,
  /^Run it in your practice copy too: you will see the same result\.$/,
  /^(No commands this time\.|Same skills as earlier lessons\.|Same skill as an earlier step\.)( Same skills as earlier lessons\.)?$/,
  // Questions, warm-ups and hints (247).
  /^(Check my answer|That's my guess|Show the answer|Show the exact command|Not now)$/,
  /^(Make your guess\.|Pick an answer\.|Type your answer\.|Not yet\. Try another answer\.|That's right\.|Here is the answer\.|Here's what happens\.)$/,
  /^(Right|The answer)$/,
  /^(While you wait|Your result is in\.)$/,
  /^(A quick look back at |A quick look back at an earlier lesson\.|A quick look back at the (Beginner|Intermediate|Advanced) level\.)$/,
  /^Warm-ups bring back a skill from before, so it sticks\.$/,
  /^(Hints open once you have run Check again\.|Hints open once you have tried an answer\.)$/,
  /^Show the exact command\? This step then counts as Every command shown\.$/,
  /^Hint \d+\. ?$/,
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
    expect(screen.getByText("Hi Ali!")).toBeInTheDocument();
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

  test("a welcomed copy not mid-Lesson continues to the course's next Lesson", async () => {
    const user = userEvent.setup();
    const at = snapshotOf(overviewAt("b-4"), {
      welcomed: true,
      course: fullCourse,
    });
    const page = renderConnected("/", at);
    const title = overviewAt("b-4").title.replaceAll("`", "");
    expect(
      screen.queryByRole("button", { name: "Start the first lesson" }),
    ).not.toBeInTheDocument();
    expect(document.title).toMatch(/^Welcome back/);
    expect(unquoted(at)).toEqual([]);
    const held = page.hold();
    await user.click(
      screen.getByRole("button", { name: `Continue: ${title}` }),
    );
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-4" }]);
    page.answer({ ...at, revision: at.revision + 1 });
    await held.release();
    await waitFor(() => {
      expect(page.router.state.location.pathname).toBe("/lesson/b-4");
    });
  });

  test("a welcomed copy with a complete Lesson opens the course's next with lesson.open", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/",
      snapshotOf(complete, { welcomed: true, course: fullCourse }),
    );
    await user.click(screen.getByRole("button", { name: /^Continue: / }));
    expect(page.posts).toEqual([
      { type: "lesson.open", lesson: fullCourse.next },
    ]);
  });

  test("a welcomed copy with nothing next offers no Start or Continue", () => {
    renderConnected(
      "/",
      snapshotOf(complete, { welcomed: true, course: courseDone }),
    );
    expect(
      screen.queryByRole("button", {
        name: /^(Start the first lesson|Continue)/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See all three levels" }),
    ).toBeInTheDocument();
  });
});

/** An overview with these check items. */
function withCheck(lesson: OverviewLesson, check: string[]): OverviewLesson {
  return { ...lesson, check };
}

describe("Lesson overview", () => {
  test("quotes the Lesson and starts it as planned or with less help", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1", snapshotOf(overview));
    expect(
      screen.getByRole("heading", { level: 1, name: overview.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("about 20 minutes")).toBeInTheDocument();
    expect(document.querySelector("[data-overview-stamp]")).toHaveTextContent(
      /^Verified against Claude Code v2\.1\.309 \(stable\) on 2026-11-02$/,
    );
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

  test("a Lesson with no Stamp shows its time estimate alone", () => {
    const noStamp = {
      ...course,
      levels: course.levels.map((level) => ({
        ...level,
        lessons: level.lessons.map((lesson) => ({ ...lesson, stamp: "" })),
      })),
    };
    renderConnected("/lesson/b-1", snapshotOf(overview, { course: noStamp }));
    expect(screen.getByText("about 20 minutes")).toBeInTheDocument();
    expect(document.querySelector("[data-overview-stamp]")).toBeNull();
    expect(screen.queryByText(/Verified against/)).not.toBeInTheDocument();
    expect(screen.queryByText("·")).not.toBeInTheDocument();
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
        needs: [{ quote: "You need `jq` installed.", missing: ["jq"] }],
        notes: [
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
    expect(
      document.querySelector("[data-overview-needs] li"),
    ).toHaveTextContent("Not found on your PATH: jq");
    const notes = document.querySelectorAll("[data-overview-notes] > li");
    expect(notes).toHaveLength(1);
    const offer = within(notes[0] as HTMLElement).getByRole("button", {
      name: "Open Permission modes and plan mode first",
    });
    await user.click(offer);
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-2" }]);
  });

  test("each You need line shows once, found, missing or still looked for", () => {
    renderConnected(
      "/lesson/b-1",
      snapshotOf({
        ...overview,
        needs: [
          { quote: "You need `python3`.", missing: [] },
          { quote: "You need `jq` and `yq`.", missing: ["jq", "yq"] },
          { quote: "You need `bwrap` on Linux.", missing: null },
        ],
        // A need note left in the snapshot does not say a line again.
        notes: [
          { kind: "need", quote: "You need `jq` and `yq`.", missing: ["jq"] },
        ],
      }),
    );
    const lines = document.querySelectorAll("[data-overview-needs] li");
    expect([...lines].map((li) => li.textContent)).toEqual([
      "You need python3.Found on your PATH.",
      "You need jq and yq.Not found on your PATH: jq yq",
      "You need bwrap on Linux.Looking on your PATH...",
    ]);
    expect(document.querySelector("[data-overview-notes]")).toBeNull();
  });

  test("no needs here, no What you need list", () => {
    renderConnected("/lesson/b-1", snapshotOf(overview));
    expect(document.querySelector("[data-overview-needs]")).toBeNull();
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
          folderQuestion: q({ current: "/home/ali/practice", open: false }),
        },
        { course: fullCourse, revision: 2 },
      ),
    );
    expect(slot).toHaveTextContent("Work folder: this practice copy");
    // The answer taken: Start appears and takes focus.
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
    page.send(
      snapshotOf(
        { ...i1, folderQuestion: q({ current: "/home/ali/app", open: false }) },
        { course: fullCourse, revision: 3 },
      ),
    );
    expect(
      screen.getByRole("region", { name: "Work folder" }),
    ).toHaveTextContent("Work folder: /home/ali/app");
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(page.posts).toEqual([{ type: "folder.ask", key: "intermediate" }]);
    // Editing a saved answer can be left with Cancel.
    page.send(
      snapshotOf(
        { ...i1, folderQuestion: q({ current: "/home/ali/app" }) },
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
        needs: [
          { quote: "You need `jq` installed.", missing: ["jq"] },
          { quote: "You need `python3`.", missing: [] },
          { quote: "You need `bwrap` on Linux.", missing: null },
        ],
        notes: [
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
    expect(page.posts).toEqual([
      {
        type: "check.run",
        beat: `${playing.id}:${playing.step?.id ?? ""}:${String(playing.beat?.index)}`,
      },
    ]);
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
        decidedBy: "learner" as const,
        status: "waiting" as const,
        verification: [],
        fail: null,
        self: "Self-check (not tested): you can say which model it was.",
      },
    };
    page.send(snapshotOf(self, { revision: 2 }));
    await user.click(screen.getByRole("button", { name: "Yes, I can" }));
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

  test("no word on a Step-down or a step's done feedback praises how the work was done", () => {
    const banned = /first try|no hints|fast|quick(ly)?|streak/i;
    for (const lesson of [stepDown, stepDownGuided, watchPassed]) {
      renderConnected("/lesson/b-1/step", snapshotOf(lesson));
      expect(document.body.textContent).not.toMatch(banned);
      for (const named of document.querySelectorAll("[aria-label]"))
        expect(named.getAttribute("aria-label")).not.toMatch(banned);
      cleanup();
    }
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

  test("lists every Lesson by its title in course order, a code span as code", async () => {
    const user = userEvent.setup();
    const levels = fullCourse.levels.map((level) => ({
      ...level,
      lessons: level.lessons.map((l) =>
        l.id === "b-5" ? { ...l, title: "Project memory with `CLAUDE.md`" } : l,
      ),
    }));
    renderConnected(
      "/journey",
      snapshotOf(overviewAt("b-4"), {
        welcomed: true,
        course: { ...fullCourse, levels },
      }),
    );
    const shown: string[] = [];
    for (const tab of screen.getAllByRole("tab")) {
      await user.click(tab);
      const panel = screen.getByRole("tabpanel");
      for (const node of panel.querySelectorAll("a[data-state]"))
        shown.push(
          node.nextElementSibling?.firstElementChild?.textContent ?? "",
        );
    }
    expect(shown).toEqual(
      levels.flatMap((level) =>
        level.lessons.map((l) => l.title.replaceAll("`", "")),
      ),
    );
    await user.click(screen.getAllByRole("tab")[0] as HTMLElement);
    const b5 = screen.getByRole("link", { name: /CLAUDE\.md/ });
    expect(b5.nextElementSibling?.querySelector("code")).toHaveTextContent(
      "CLAUDE.md",
    );
    expect(screen.getByRole("tabpanel")).not.toHaveTextContent("`");
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
      "InstallEvery command shown",
      "AskOn your own",
      "ExitWith hints",
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

/** Key names: no workspace string may name one (246). */
const KEY_NAMES =
  /\b(press|key|keys|Enter|Esc(ape)?|Ctrl|Cmd|Tab|Space(bar)?|Return)\b/i;

const bubbleText = () =>
  document.querySelector("[data-says-words]")?.textContent ?? "";

describe("Lesson workspace, every step (246)", () => {
  const variants = [
    ["a timeout", checkBroken, "The check took too long this time."],
    ["the same again", checkSame, "The check saw the same as last time."],
    [
      "nothing changed",
      checkStale,
      "Nothing has changed there since this step opened.",
    ],
    ["items running", checkRunning, "Checking item 2 of 5…"],
    ["a watched path", watchChecking, "Checking notes.md…"],
    ["watching", watchWaiting, "Watching your Practice copy."],
    ["a beat its button decides", sessionBeat, "Watching your Practice copy."],
    ["already done", alreadyCodespace, "Already done, so this step counts."],
  ] as const;

  test.each(variants)(
    "the bubble says %s in the app's words",
    (_name, lesson, words) => {
      renderConnected("/lesson/b-1/step", snapshotOf(lesson));
      expect(bubbleText()).toContain(words);
      expect(unquoted(snapshotOf(lesson))).toEqual([]);
    },
  );

  test("a skill practised at an earlier step says so in plain words, a capstone's for every lesson before it (348)", () => {
    const step = learnerBeat.step;
    if (!step) throw new Error("learnerBeat has a step");
    const again = { ...learnerBeat, step: { ...step, doneBefore: true } };
    renderConnected("/lesson/b-1/step", snapshotOf(again));
    expect(screen.getByText("Same skill as an earlier step.")).toBeVisible();
    expect(screen.queryByText(/done this before/)).toBeNull();
    expect(unquoted(snapshotOf(again))).toEqual([]);
    cleanup();
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf({ ...again, capstone: true }),
    );
    expect(screen.getByText("Same skills as earlier lessons.")).toBeVisible();
  });

  test("a guess made says what happens, not that the step is done, and marks the right answer (348)", () => {
    const beat = predictBeat.beat;
    if (!beat) throw new Error("predictBeat has a beat");
    const guessed: PlayingLesson = {
      ...predictBeat,
      beat: {
        ...beat,
        status: "done",
        last: false,
        options: [
          { text: "Nothing at all", kind: "option", because: "It prints." },
          { text: "A version number", kind: "right" },
        ],
        answer: { ...beat.answer, picked: 0 },
      },
    };
    renderConnected("/lesson/b-1/step", snapshotOf(guessed));
    expect(bubbleText()).toContain("Here's what happens.");
    expect(bubbleText()).not.toContain("That step is done.");
    const right = document.querySelector("[data-state=right]");
    expect(right).toHaveTextContent(/A version number/);
    expect(right).toHaveTextContent(/Right/);
    expect(document.querySelector("[data-state=chosen]")).toHaveTextContent(
      /Nothing at all/,
    );
    expect(unquoted(snapshotOf(guessed))).toEqual([]);
  });

  test("a watched beat offers Check again before its first look, and sends check.run once", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(watchWaiting));
    expect(screen.queryByRole("button", { name: "I've done it" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(page.posts).toEqual([
      {
        type: "check.run",
        beat: `${watchWaiting.id}:${watchWaiting.step?.id ?? ""}:${String(watchWaiting.beat?.index)}`,
      },
    ]);
  });

  test("the Learner's beat sends step.markDone with its label; a session sends session.ended", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(learnerBeat));
    await user.click(screen.getByRole("button", { name: "I've said it" }));
    page.send(snapshotOf(sessionBeat, { revision: 2 }));
    await user.click(
      await screen.findByRole("button", { name: "The session has ended" }),
    );
    expect(page.posts).toEqual([
      { type: "step.markDone" },
      { type: "session.ended" },
    ]);
  });

  test("Back and Skip point to the lines that say why", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(offersBoth));
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toHaveAccessibleDescription(
      "Back to Read the cited lines: Reopen the cited source line and compare the claim with it.",
    );
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip).toHaveAccessibleDescription(
      "Skip it if you have no second machine.",
    );
    expect(unquoted(snapshotOf(offersBoth))).toEqual([]);
  });

  test("a watched beat's Done when line becomes its Check line, then shows what was found", () => {
    const page = renderConnected("/lesson/b-1/step", snapshotOf(watchWaiting));
    const lines = () => [
      ...document.querySelectorAll("[data-pip-target='lines'] li"),
    ];
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toHaveAttribute("data-state", "waiting");
    expect(lines()[0]).toHaveTextContent("Done when notes.md exists.");
    // The Done when words show once, as the line, not again as a paragraph.
    expect(screen.getAllByText(/Done when/)).toHaveLength(1);
    page.send(snapshotOf(watchNotYet, { revision: 2 }));
    expect(lines()[0]).toHaveAttribute("data-state", "not-yet");
    expect(document.querySelector("[data-not-yet]")).toHaveTextContent(
      "notes.md is not there yet.",
    );
    page.send(snapshotOf(watchPassed, { revision: 3 }));
    expect(lines()[0]).toHaveAttribute("data-state", "ok");
    expect(lines()[0]).toHaveTextContent("Found notes.md.");
    expect(lines()[0]?.querySelector("pre")).toHaveTextContent("# Notes");
    expect(unquoted(snapshotOf(watchPassed))).toEqual([]);
  });

  test("an already-done step in a Codespace shows the page's words", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(alreadyCodespace));
    expect(document.querySelector("[data-codespace] strong")).toHaveTextContent(
      "Claude Code",
    );
  });

  test("a code beat shows its window, its explained line and one Copy", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(codeWindow));
    const block = document.querySelector("[data-code-block]");
    expect(
      [...(block?.querySelectorAll("[data-line]") ?? [])].map((l) =>
        l.getAttribute("data-line"),
      ),
    ).toEqual(["9", "10", "11"]);
    expect(block?.querySelector("[data-point]")).toHaveAttribute(
      "data-line",
      "10",
    );
    expect(screen.getAllByRole("button", { name: /^Copy/ })).toHaveLength(1);
  });

  test("a Tear down step says where it is, and the first says why", () => {
    const view = {
      ...course,
      levels: course.levels.map((level) => ({
        ...level,
        lessons: level.lessons.map((lesson) =>
          lesson.id === "b-1" ? { ...lesson, tearDownLeft: true } : lesson,
        ),
      })),
    };
    renderConnected("/lesson/b-1/step", snapshotOf(tearDown, { course: view }));
    expect(screen.getByText(/Tear down, step 1 of 2$/)).toBeInTheDocument();
    expect(document.querySelector("[data-tear-down]")).toHaveTextContent(
      "The Check passed. These steps put things back as they were.",
    );
    expect(unquoted(snapshotOf(tearDown, { course: view }))).toEqual([]);
  });

  test("no Badge on a Tear down step, after the Check passed (rehoming row 627)", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(tearDown));
    expect(screen.getByText(/Tear down, step 1 of 2$/)).toBeInTheDocument();
    expect(document.querySelector("[data-badge-shape]")).toBeNull();
  });

  test("row A: the Where line names the folder", () => {
    renderConnected(
      "/lesson/i-1/step",
      snapshotOf(workFolderCheck, { course: fullCourse }),
    );
    expect(document.querySelector("[data-where]")).toHaveTextContent(
      /Your terminal\s*in your Practice copy/,
    );
  });

  test("the shell's Where label names no ordinal", () => {
    const step = playing.step as NonNullable<PlayingLesson["step"]>;
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf({
        ...playing,
        step: {
          ...step,
          where: { kind: "shell", terminal: null, folder: null },
        },
      }),
    );
    const where = document.querySelector("[data-where=shell]");
    expect(where).toHaveTextContent("A shell");
    expect(where).not.toHaveTextContent(/\d|first|second|third|other/i);
  });

  test("row B: an i-1 Check keeps --dir on its run line and works in the Practice copy", () => {
    renderConnected(
      "/lesson/i-1/step",
      snapshotOf(workFolderCheck, { course: fullCourse }),
    );
    expect(document.querySelector("main code")).toHaveTextContent(
      "npm run check -- i-1 --dir ../work",
    );
    expect(document.querySelector("[data-where]")).toHaveTextContent(
      "Practice copy",
    );
  });

  test('row D: no workspace string says "your other terminal"', () => {
    for (const lesson of [playing, workFolderCheck, watchWaiting, tearDown]) {
      renderConnected("/lesson/b-1/step", snapshotOf(lesson));
      expect(document.body.textContent).not.toMatch(/your other terminal/i);
      cleanup();
    }
  });

  const ranInWork = (lesson: typeof watchPassed, ranIn: string | null) => ({
    ...lesson,
    beat: lesson.beat && { ...lesson.beat, ranIn },
  });
  const RUN_IT_TOO =
    "Run it in your practice copy too: you will see the same result.";

  test("row C: a passed Check that ran in a Work folder says to run it in the Practice copy too", () => {
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf(ranInWork(watchPassed, "/home/ali/work")),
    );
    expect(document.querySelector("[data-ran-in]")).toHaveTextContent(
      RUN_IT_TOO,
    );
  });

  test("row C: no run-it-too line when the Check ran in the Practice copy", () => {
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf(ranInWork(watchPassed, null)),
    );
    expect(document.querySelector("[data-ran-in]")).toBeNull();
  });

  test("row C: no run-it-too line before the Check passes", () => {
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf(ranInWork(watchNotYet, "/home/ali/work")),
    );
    expect(document.querySelector("[data-ran-in]")).toBeNull();
    expect(document.body.textContent).not.toContain(RUN_IT_TOO);
  });

  test("a session beat shows its done-label and one click sends one session.ended", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(sessionBeat));
    const bar = document.querySelector("[data-action-bar]");
    expect(bar).toHaveTextContent("The session has ended");
    await user.click(
      screen.getByRole("button", { name: "The session has ended" }),
    );
    expect(page.posts).toEqual([{ type: "session.ended" }]);
    expect(page.posts).not.toContainEqual({ type: "step.markDone" });
  });

  test("bold and links in a say and a why render through InlineText; a watched command ticks", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(richCopy));
    const say = document.querySelector("[data-line-kind=say]");
    expect(say?.querySelector("strong")).toHaveTextContent("the settings");
    expect(say?.querySelector("a")).toHaveTextContent("the page");
    const why = document.querySelector("[data-why]");
    expect(why?.querySelector("strong")).toHaveTextContent("faster");
    expect(why?.querySelector("a")).toHaveAttribute(
      "href",
      "https://code.claude.com/docs",
    );
    expect(why?.firstElementChild).toHaveClass("text-accent-text");
    expect(document.querySelector("[data-watched]")).not.toBeNull();
  });

  test("the Why quote, a step's notes and its Windows note are body text, never muted", () => {
    const beat = richCopy.beat as NonNullable<PlayingLesson["beat"]>;
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf({
        ...richCopy,
        beat: {
          ...beat,
          lines: [
            ...beat.lines,
            { kind: "note", text: "The sign-in opens a browser." },
          ],
          winNote: "On Windows, use PowerShell.",
        },
      }),
    );
    const quote = document.querySelector("[data-why] strong");
    const note = document.querySelector("[data-line-kind=note]");
    const win = document.querySelector("[data-win-note]");
    for (const el of [quote, note, win]) {
      expect(el).not.toBeNull();
      expect(el?.closest(".text-muted")).toBeNull();
    }
  });

  test("Copy is not doing the step: it posts nothing and the step stays as it was", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(richCopy));
    // The card's words, the Copy button's own label and announcement aside.
    const card = () => {
      const copy = document
        .querySelector("article")
        ?.cloneNode(true) as Element;
      for (const c of copy.querySelectorAll(
        "[data-pip-target=command] :is(button, [role=status])",
      ))
        c.remove();
      return copy.textContent;
    };
    const before = card();
    await user.click(
      screen.getByRole("button", { name: "Copy npm run check -- b-1" }),
    );
    expect(page.posts).toEqual([]);
    expect(card()).toBe(before);
  });

  test("one Copy for each command shown, and none on a beat of prose alone", () => {
    const beat = richCopy.beat as NonNullable<PlayingLesson["beat"]>;
    const withLines = (
      lines: PlayingLesson["beat"] extends infer B
        ? B extends { lines: infer L }
          ? L
          : never
        : never,
    ) => snapshotOf({ ...richCopy, beat: { ...beat, lines } });
    renderConnected(
      "/lesson/b-1/step",
      withLines([...beat.lines, { kind: "run", text: "git status" }]),
    );
    expect(screen.getAllByRole("button", { name: /^Copy/ })).toHaveLength(2);
    cleanup();
    renderConnected(
      "/lesson/b-1/step",
      withLines([{ kind: "say", text: "Read the notes file." }]),
    );
    expect(screen.queryAllByRole("button", { name: /^Copy/ })).toHaveLength(0);
  });

  test("a code block keeps its Copy once the step has passed, done or already done", () => {
    const beat = codeWindow.beat as NonNullable<PlayingLesson["beat"]>;
    for (const status of ["done", "already"] as const) {
      renderConnected(
        "/lesson/b-1/step",
        snapshotOf({ ...codeWindow, beat: { ...beat, status } }),
      );
      expect(
        within(
          document.querySelector("[data-code-block]") as HTMLElement,
        ).getAllByRole("button", { name: /^Copy/ }),
      ).toHaveLength(1);
      cleanup();
    }
  });

  test("an unanswered ask beat with a code block above its question offers Copy", () => {
    const beat = askBeat.beat as NonNullable<PlayingLesson["beat"]>;
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf({
        ...askBeat,
        beat: { ...beat, code: (codeWindow.beat as typeof beat).code },
      }),
    );
    expect(
      within(
        document.querySelector("[data-code-block]") as HTMLElement,
      ).getAllByRole("button", { name: /^Copy/ }),
    ).toHaveLength(1);
  });

  test("no app word on the workspace names a key", () => {
    for (const word of APP_WORDS)
      expect(word.source, word.source).not.toMatch(KEY_NAMES);
  });

  test("no unquoted workspace text names a key, in any fixture", () => {
    const fixtures = [
      playing,
      watchWaiting,
      watchChecking,
      watchNotYet,
      watchPassed,
      checkBroken,
      checkSame,
      checkStale,
      checkRunning,
      alreadyCodespace,
      learnerBeat,
      sessionBeat,
      codeWindow,
      offersBoth,
      tearDown,
      workFolderCheck,
      richCopy,
      ...QUESTION_FIXTURES,
    ];
    for (const lesson of fixtures) {
      renderConnected("/lesson/b-1/step", snapshotOf(lesson));
      const quoted = quotes(snapshotOf(lesson));
      const roots = [
        document.querySelector("[data-screen]"),
        document.querySelector("[data-action-bar]"),
      ];
      for (const root of roots) {
        const walker = document.createTreeWalker(
          root ?? document.body,
          NodeFilter.SHOW_TEXT,
        );
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent?.trim() ?? "";
          if (text === "" || quoted.some((q) => q.includes(text))) continue;
          expect(text).not.toMatch(KEY_NAMES);
        }
      }
      cleanup();
    }
  });
});

const QUESTION_FIXTURES = [
  predictBeat,
  askBeat,
  askWrong,
  askRight,
  askRevealed,
  typeBeat,
  typeWrong,
  whenOption,
  warmupAsk,
  warmupAskQuiet,
  waitQuestionOpen,
  waitQuestionAnswered,
  challengeUnavailable,
  challengeUnavailableAnswer,
  confirmExact,
  exactTaken,
];

describe("Lesson workspace, questions and hints (247)", () => {
  test.each(QUESTION_FIXTURES.map((lesson, i) => [i, lesson] as const))(
    "fixture %i shows only the app's words and quotes",
    (_i, lesson) => {
      renderConnected(`/lesson/${lesson.id}/step`, snapshotOf(lesson));
      expect(unquoted(snapshotOf(lesson))).toEqual([]);
    },
  );

  test("moving between answers posts nothing; the button sends one answer.pick", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(askBeat));
    expect(bubbleText()).toContain("Pick an answer.");
    // The question is decided by its answer: no Check again, no breathing dot.
    expect(screen.queryByRole("button", { name: "Check again" })).toBeNull();
    expect(
      document.querySelector("[data-says-words] .animate-breathe"),
    ).toBeNull();
    await user.click(screen.getByRole("radio", { name: "CLAUDE.md" }));
    await user.keyboard("{ArrowDown}");
    expect(page.posts).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(page.posts).toEqual([{ type: "answer.pick", option: 1 }]);
  });

  test("a predict is sent as a guess, and drawn chosen with no judgement", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(predictBeat));
    expect(bubbleText()).toContain("Make your guess.");
    await user.click(screen.getByRole("radio", { name: "Nothing at all" }));
    await user.click(screen.getByRole("button", { name: "That's my guess" }));
    expect(page.posts).toEqual([{ type: "answer.pick", option: 1 }]);
    cleanup();
    renderConnected("/lesson/b-1/step", snapshotOf(whenOption));
    expect(document.querySelector("[data-state=chosen]")).toHaveTextContent(
      "zsh",
    );
    expect(
      document.querySelector("[data-state=right], [data-state=notYet]"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Next step" })).toBeVisible();
  });

  test("a wrong pick keeps the step, says its reason once and offers the answer", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(askWrong));
    expect(bubbleText()).toContain("Not yet. Try another answer.");
    expect(document.querySelector("[data-state=notYet]")).toHaveTextContent(
      "Every file in the folder",
    );
    expect(
      screen.getAllByText("It reads only the files a task needs."),
    ).toHaveLength(1);
    expect(document.querySelector("[data-answer-because]")).toBeNull();
    expect(document.querySelector("[data-answer-point]")).toHaveTextContent(
      "Look for the file named",
    );
    expect(document.querySelector("[data-why]")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Show the answer" }));
    expect(page.posts).toEqual([{ type: "answer.reveal" }]);
    page.send(snapshotOf(askRevealed, { revision: 2 }));
    expect(bubbleText()).toContain("Here is the answer.");
    expect(document.querySelector("[data-state=shown]")).toHaveTextContent(
      "The answer",
    );
    expect(
      screen.queryByRole("button", { name: "Show the answer" }),
    ).toBeNull();
  });

  test("a right pick says so and goes on", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(askRight));
    expect(bubbleText()).toContain("That's right.");
    expect(document.querySelector("[data-state=right]")).toHaveTextContent(
      "CLAUDE.md",
    );
    expect(
      screen.queryByRole("button", { name: "Check my answer" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Next step" })).toBeVisible();
  });

  test("a typed answer posts its text, at most 200 characters, and stays after a miss", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(typeBeat));
    expect(bubbleText()).toContain("Type your answer.");
    const box = screen.getByRole("textbox", {
      name: "Which command shows the session's cost?",
    });
    expect(box).toHaveAttribute("maxlength", "200");
    await user.type(box, "/usage{Enter}");
    expect(page.posts).toEqual([{ type: "answer.type", text: "/usage" }]);
    page.send(snapshotOf(typeWrong, { revision: 2 }));
    expect(box).toHaveValue("/usage");
    expect(document.querySelector("[data-answer-because]")).toHaveTextContent(
      "It starts with a slash.",
    );
  });

  test("a typed warm-up: s types into the field, Backspace edits it, and an empty answer is sent", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/b-2/step",
      snapshotOf({
        ...typeBeat,
        id: "b-2",
        step: {
          ...(typeBeat.step as NonNullable<PlayingLesson["step"]>),
          warmup: { from: "b-1", explainer: false },
        },
      }),
    );
    const box = screen.getByRole("textbox", {
      name: "Which command shows the session's cost?",
    });
    await user.type(box, "sx{Backspace}");
    expect(box).toHaveValue("s");
    expect(page.posts).toEqual([]);
    await user.clear(box);
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(page.posts).toEqual([{ type: "answer.type", text: "" }]);
  });

  test("at Challenge, a beat nothing checks and a question with no wrong answer open a hint at once", async () => {
    const user = userEvent.setup();
    const choices = (
      askBeat.beat as NonNullable<PlayingLesson["beat"]>
    ).options.map((o) => ({ text: o.text }));
    for (const lesson of [
      learnerBeat,
      {
        ...askBeat,
        beat: {
          ...(askBeat.beat as NonNullable<PlayingLesson["beat"]>),
          options: choices,
        },
      },
    ]) {
      const page = renderConnected(
        "/lesson/b-1/step",
        snapshotOf({
          ...lesson,
          step: {
            ...(lesson.step as NonNullable<PlayingLesson["step"]>),
            tier: "challenge",
          },
          hints: {
            shown: [],
            available: true,
            unavailable: null,
            confirmExact: false,
          },
        }),
      );
      expect(document.querySelector("[data-hints-unavailable]")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Show a hint" }));
      expect(page.posts).toEqual([{ type: "hint.next" }]);
      cleanup();
    }
  });

  test("the hints say why they wait, and the exact command asks first", async () => {
    const user = userEvent.setup();
    renderConnected("/lesson/b-1/step", snapshotOf(challengeUnavailable));
    expect(
      document.querySelector("[data-hints-unavailable]"),
    ).toHaveTextContent("Hints open once you have run Check again.");
    expect(screen.queryByRole("button", { name: "Show a hint" })).toBeNull();
    cleanup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(confirmExact));
    expect(screen.queryByRole("button", { name: "Another hint" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Show the exact command" }),
    );
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(page.posts).toEqual([
      { type: "hint.takeExact", take: true },
      { type: "hint.takeExact", take: false },
    ]);
    cleanup();
    renderConnected("/lesson/b-1/step", snapshotOf(exactTaken));
    const rungs = document.querySelectorAll("[data-hint-rung]");
    expect(rungs[1]).toHaveTextContent("Run the check:");
    expect(
      within(rungs[1] as HTMLElement).getByRole("button", {
        name: "Copy npm run check -- b-1",
      }),
    ).toBeInTheDocument();
  });

  test("the exact-command rung: its lead-in before the Command with Copy, and its whole code block to copy only once taken", async () => {
    const user = userEvent.setup();
    const code = (codeWindow.beat as NonNullable<PlayingLesson["beat"]>).code;
    renderConnected("/lesson/b-1/step", snapshotOf(confirmExact));
    expect(screen.queryByRole("button", { name: "Copy the code" })).toBeNull();
    cleanup();
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf({
        ...exactTaken,
        hints: {
          ...exactTaken.hints,
          shown: [
            ...exactTaken.hints.shown.slice(0, -1),
            {
              kind: "exact",
              commands: [
                {
                  leadIn: "For example, in the practice copy:",
                  text: "node fetch.js",
                  code,
                },
              ],
            },
          ],
        },
      }),
    );
    const rung = [...document.querySelectorAll("[data-hint-rung]")].at(
      -1,
    ) as HTMLElement;
    const leadIn = within(rung).getByText("For example, in the practice copy:");
    const command = rung.querySelector("[data-pip-target=command]");
    expect(command).toHaveTextContent("node fetch.js");
    expect(
      leadIn.compareDocumentPosition(command as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    within(rung).getByRole("button", { name: "Copy node fetch.js" });
    await user.click(
      within(rung).getByRole("button", { name: "Copy the code" }),
    );
    expect(await navigator.clipboard.readText()).toBe(code?.copy);
  });

  test("a warm-up names the Lesson it looks back at", () => {
    renderConnected("/lesson/b-2/step", snapshotOf(warmupAsk));
    expect(document.querySelector("[data-warmup]")).toHaveTextContent(
      "A quick look back at Install, sign in and look around.",
    );
    expect(document.querySelector("[data-warmup]")).toHaveTextContent(
      "Warm-ups bring back a skill from before, so it sticks.",
    );
    cleanup();
    renderConnected("/lesson/b-2/step", snapshotOf(warmupAskQuiet));
    expect(document.querySelector("[data-warmup]")).not.toHaveTextContent(
      "Warm-ups",
    );
  });

  test("a warm-up from its own Level names no Level in its label", () => {
    renderConnected("/lesson/b-2/step", snapshotOf(warmupAsk));
    expect(document.querySelector("[data-warmup] p")).not.toHaveTextContent(
      /Beginner|Intermediate|Advanced|level/i,
    );
  });

  test("a warm-up from a Level index names the Level and no lesson", () => {
    for (const [from, name] of [
      ["beginner-index", "Beginner"],
      ["intermediate-index", "Intermediate"],
    ] as const) {
      renderConnected(
        "/lesson/b-2/step",
        snapshotOf({
          ...warmupAsk,
          step: { ...warmupAsk.step, warmup: { from, explainer: false } },
        }),
      );
      const label = document.querySelector("[data-warmup]");
      expect(label).toHaveTextContent(
        `A quick look back at the ${name} level.`,
      );
      expect(label).not.toHaveTextContent(/lesson/i);
      cleanup();
    }
  });

  test("the waiting question answers, puts away, and stays read only once the wait ends", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/b-1/step",
      snapshotOf(waitQuestionOpen),
    );
    const section = () => document.querySelector("[data-wait-question]");
    expect(section()).toHaveTextContent("While you wait");
    await user.click(screen.getByRole("radio", { name: "README.md" }));
    expect(page.posts).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Check my answer" }));
    expect(page.posts).toEqual([{ type: "waitQuestion.answer", option: 1 }]);
    page.send(snapshotOf(waitQuestionAnswered, { revision: 2 }));
    expect(section()).toHaveTextContent("Yes: CLAUDE.md holds them.");
    page.send(snapshotOf(waitQuestionEnded, { revision: 3 }));
    expect(section()).toHaveTextContent("Your result is in.");
    expect(section()?.querySelector("fieldset")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    cleanup();
    renderConnected("/lesson/b-1/step", snapshotOf(waitQuestionOpen));
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(section()).toBeNull();
  });
});

// The check rung on a Not yet (row 423 and learn-check-says, 247 and 254):
// every real Beginner FAIL message, from test/beginner-failures.json.
describe("Lesson workspace, the check rung on a Not yet", () => {
  const LINES = [
    { kind: "goal", text: "Correct the claim the code contradicts." },
    { kind: "do", text: "Open the note and fix the one wrong line." },
    { kind: "say", text: "The check reads the note again." },
  ] as const;
  const notYet = (message: string): typeof playing => ({
    ...playing,
    beat: playing.beat && {
      ...playing.beat,
      lines: [...playing.beat.lines, ...LINES],
      fail: message,
    },
    hints: {
      ...playing.hints,
      shown: [
        { kind: "ask", text: "Which file decides it?" },
        { kind: "check", text: message },
      ],
      available: false,
    },
  });
  /**
   * The words, without code-span marks: a drawn span loses its marks. (A
   * double-backtick span, b-5's "rule missing", keeps a stray mark today.)
   */
  const shown = (message: string) => message.replaceAll("`", "");
  const CLIPS = /\b(truncate|line-clamp-\d+|text-ellipsis|max-h-\S+|h-\d+)\b/;
  /** A clipping class on the element or an ancestor inside the screen. */
  const clipped = (el: Element) => {
    for (
      let at: Element | null = el;
      at && !at.matches("[data-screen]");
      at = at.parentElement
    )
      if (CLIPS.test(at.getAttribute("class") ?? ""))
        return at.getAttribute("class");
    return null;
  };

  test("the fixture holds every Beginner lesson's real FAIL messages", () => {
    expect(new Set(FAILURES.map((f) => f.lesson))).toEqual(
      new Set(["b-1", "b-2", "b-3", "b-4", "b-5", "b-capstone"]),
    );
    for (const f of FAILURES) expect(f.message, f.name).toMatch(/\S/);
  });

  test.each(FAILURES.map((f) => [`${f.lesson} ${f.name}`, f.message] as const))(
    "%s: the step title stays on the card beside the real FAIL message",
    (_name, message) => {
      renderConnected("/lesson/b-1/step", snapshotOf(notYet(message)));
      expect(
        screen.getByRole("heading", { level: 1, name: "Check" }),
      ).toBeVisible();
    },
  );

  test.each(FAILURES.map((f) => [`${f.lesson} ${f.name}`, f.message] as const))(
    "%s: every goal, do and say line stays beside the real FAIL message",
    (_name, message) => {
      renderConnected("/lesson/b-1/step", snapshotOf(notYet(message)));
      for (const line of LINES)
        expect(screen.getByText(line.text), line.kind).toBeVisible();
    },
  );

  test.each(FAILURES.map((f) => [`${f.lesson} ${f.name}`, f.message] as const))(
    "%s: the check rung and the Not yet line show the whole FAIL message, never clipped",
    (_name, message) => {
      renderConnected("/lesson/b-1/step", snapshotOf(notYet(message)));
      const rungs = document.querySelectorAll("[data-hint-rung]");
      const rung = rungs[rungs.length - 1];
      expect(shown(rung?.textContent ?? "")).toBe(`Hint 2. ${shown(message)}`);
      const line = document.querySelector("[data-not-yet]");
      expect(shown(line?.textContent ?? "")).toBe(shown(message));
      expect(line?.closest("li")?.textContent).toContain("Not yet: ");
      // The rung opens through its height (Hints.tsx), so jsdom, which
      // runs no animation, sees it closed: its words are checked whole.
      expect(line).toBeVisible();
      for (const el of [rung, line]) expect(clipped(el as Element)).toBeNull();
    },
  );

  test("on a Not yet, the title, the Goal, the Not yet label and the whole message show together", () => {
    for (const { message } of FAILURES) {
      renderConnected("/lesson/b-1/step", snapshotOf(notYet(message)));
      const text = shown(
        document.querySelector("[data-screen]")?.textContent ?? "",
      );
      for (const part of ["Check", LINES[0].text, "Not yet: ", shown(message)])
        expect(text, message).toContain(part);
      cleanup();
    }
  });
});
