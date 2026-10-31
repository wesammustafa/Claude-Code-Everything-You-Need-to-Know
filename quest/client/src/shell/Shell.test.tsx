import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, test } from "vitest";
import type { Snapshot } from "@quest/contract";
import {
  complete,
  fullCourse,
  overview,
  overviewAt,
  playing,
  snapshotOf,
} from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";
import { routes } from "../routes";

/** The whole course, with b-4 open on its overview. */
const atB4 = snapshotOf(overviewAt("b-4"), {
  welcomed: true,
  course: fullCourse,
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("the shell", () => {
  test("Welcome stands alone: Pip, one heading and one action, with no top bar", () => {
    renderConnected("/", snapshotOf(overview));
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Learn Claude Code by using it.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start the first lesson" }),
    ).toBeInTheDocument();
  });

  test("the top bar names the current place among Journey and Progress", () => {
    renderAt("/journey");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Journey" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(main).getByRole("link", { name: "Progress" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(main).getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Where you are" }),
    ).not.toBeInTheDocument();
    expect(document.title).toBe("Learning journey · Claude Code Quest");
  });

  test("in a Lesson, the top bar shows the Level, the Lesson and Steps, which opens the outline", async () => {
    const user = userEvent.setup();
    renderConnected("/lesson/b-4", atB4);
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(
      within(where).getByRole("link", { name: "Beginner" }),
    ).toHaveAttribute("href", "/journey");
    expect(
      within(where).getByRole("link", { name: "Lesson 4" }),
    ).toHaveAttribute("href", "/lesson/b-4");
    await user.click(within(where).getByRole("button", { name: "Steps" }));
    expect(screen.getByRole("dialog", { name: "Steps" })).toBeInTheDocument();
  });

  test("a Lesson only browsed shows its crumbs, with no Steps", () => {
    renderConnected("/lesson/i-capstone", atB4);
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(
      within(where).getByRole("link", { name: "Intermediate" }),
    ).toHaveAttribute("href", "/journey");
    expect(
      within(where).getByRole("link", { name: "Capstone" }),
    ).toHaveAttribute("href", "/lesson/i-capstone");
    expect(
      within(where).queryByRole("button", { name: "Steps" }),
    ).not.toBeInTheDocument();
  });

  test("with no snapshot, or for an id the course lacks, the top bar has no crumbs", () => {
    renderAt("/lesson/b-3");
    expect(
      screen.queryByRole("navigation", { name: "Where you are" }),
    ).not.toBeInTheDocument();
  });

  test("a route change moves focus to the new screen's heading", async () => {
    const user = userEvent.setup();
    renderAt("/journey");
    await user.click(screen.getByRole("link", { name: "Progress" }));
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Progress",
    });
    expect(heading).toHaveFocus();
    expect(document.title).toBe("Progress · Claude Code Quest");
  });

  test("the screen enters with the rise, and the action bar sits outside it, in <body>", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(playing));
    const screenFrame = document.querySelector<HTMLElement>("[data-screen]");
    const bar = document.querySelector<HTMLElement>("[data-action-bar]");
    expect(screenFrame?.className).toContain("animate-rise");
    expect(bar?.parentElement).toBe(document.body);
    expect(screenFrame).not.toContainElement(bar);
    expect(
      within(bar as HTMLElement).getByRole("button", { name: "Check again" }),
    ).toBeInTheDocument();
  });

  test.each([
    ["/lesson/b-3/step", true],
    ["/", false],
  ])(
    "on %s the notice's live region sits in flow at the top, under any top bar, outside the animated screen",
    (path, topBar) => {
      renderAt(path);
      const region = document.querySelector<HTMLElement>(
        "[data-notice-region]",
      );
      const top = document.querySelector<HTMLElement>("[data-top]");
      const screenFrame = document.querySelector<HTMLElement>("[data-screen]");
      expect(region).not.toBeNull();
      expect(top?.className).toContain("sticky");
      expect(top?.className).toContain("top-0");
      expect(top).toContainElement(region);
      expect(screenFrame).not.toContainElement(region);
      expect(region?.parentElement).not.toBe(document.body);
      // The top bar is the group's own <header>; jsdom's role lookup also
      // counts a header inside an article as a banner, so find it by place.
      const bar = top?.querySelector(":scope > header");
      if (topBar) {
        expect(bar).not.toBeNull();
        expect(bar?.nextElementSibling).toBe(region);
      } else {
        expect(bar).toBeNull();
        expect(top?.firstElementChild).toBe(region);
      }
    },
  );

  test.each([
    ["/", "Learn Claude Code by using it.", overview],
    ["/journey", "Learning journey", overview],
    ["/lesson/b-1", "Install, sign in and look around", overview],
    ["/lesson/b-1/step", "Check", playing],
    ["/lesson/b-1/complete", "Install, sign in and look around", complete],
    ["/progress", "Progress", overview],
    ["/lesson/unknown", "Nothing here", overview],
    ["/somewhere", "Nothing here", overview],
  ])("%s renders its screen", (path, heading, lesson) => {
    renderConnected(path, snapshotOf(lesson));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      heading,
    );
  });
});

describe("the Learning journey", () => {
  test("Level cards are tabs that arrow keys move between", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/journey", atB4);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Beginner3 of 6",
      "Intermediate0 of 9",
      "Advanced0 of 8",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    await user.click(tabs[0] as HTMLElement);
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Intermediate");
    expect(
      screen.getByRole("link", {
        name: "Lesson 1: Turn a repeated workflow into a skill, to do",
      }),
    ).toBeInTheDocument();

    await user.keyboard("{End}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[0]).toHaveFocus();

    // Down and Up move too, for the cards stacked at narrow widths.
    await user.keyboard("{ArrowDown}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{Home}");
    await user.click(tabs[1] as HTMLElement);
    expect(page.posts).toEqual([]);
  });

  test("the current Lesson's crumb marks the page it names, and only there", () => {
    renderConnected("/lesson/b-4", atB4);
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(
      within(where).getByRole("link", { name: "Lesson 4" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(where).getByRole("link", { name: "Beginner" }),
    ).not.toHaveAttribute("aria-current");
  });

  test("in the workspace, the Lesson's crumb is a way back, not the current page", () => {
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf(playing, { course: fullCourse }),
    );
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(
      within(where).getByRole("link", { name: "Lesson 1" }),
    ).not.toHaveAttribute("aria-current");
  });

  test("the step's actions are a named region, not the page's footer", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(playing));
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    const actions = screen.getByRole("region", { name: "Step actions" });
    expect(
      within(actions).getByRole("button", { name: "Check again" }),
    ).toBeInTheDocument();
  });
});

describe("the Learning journey on the whole course", () => {
  const nodes = () =>
    within(screen.getByRole("tabpanel"))
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"));

  test("every Level and Lesson shows, each with its state, capstone and Badge", async () => {
    const user = userEvent.setup();
    renderConnected("/journey", atB4);
    const seen: (string | null)[] = [];
    for (const tab of screen.getAllByRole("tab")) {
      await user.click(tab);
      seen.push(...nodes());
    }
    expect(seen).toHaveLength(23);
    const lessons = fullCourse.levels.flatMap((level) => level.lessons);
    expect(seen).toEqual(
      lessons.map((lesson) => {
        const label = lesson.capstone
          ? "Capstone"
          : `Lesson ${String(lesson.number)}`;
        const state =
          lesson.id === "b-4" ? "current" : lesson.complete ? "done" : "to do";
        return `${label}: ${lesson.title}, ${state}`;
      }),
    );
    expect(seen.filter((name) => name?.startsWith("Capstone"))).toHaveLength(3);
    await user.click(screen.getAllByRole("tab")[0] as HTMLElement);
    const badges = within(screen.getByRole("tabpanel"))
      .getAllByRole("img")
      .map((img) => img.getAttribute("aria-label"));
    expect(badges).toEqual([
      "Explorer",
      "Planner",
      "Builder",
      "Navigator, not yet",
      "Keeper, not yet",
      "Beginner, not yet",
    ]);
  });

  test("the first tab is the current Lesson's Level", () => {
    const at = snapshotOf(overviewAt("i-3"), {
      welcomed: true,
      course: { ...fullCourse, next: "i-3" },
    });
    renderConnected("/journey", at);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
      /^Intermediate/,
    );
  });

  test("a new snapshot keeps the Learner's chosen Level", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/journey", atB4);
    await user.click(screen.getByRole("tab", { name: /^Advanced/ }));
    page.send({ ...atB4, revision: 2 });
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent(
      /^Advanced/,
    );
  });

  test("Tab walks from the Level tabs through each card's Electives and every Lesson to the Next band", async () => {
    const user = userEvent.setup();
    renderConnected("/journey", atB4);
    screen.getByRole("tab", { selected: true }).focus();
    const order: string[] = [];
    for (let i = 0; i < 10; i++) {
      await user.tab();
      const el = document.activeElement as HTMLElement;
      order.push(el.getAttribute("aria-label") ?? el.textContent);
    }
    expect(order.slice(0, 9).map((name) => name.split(":")[0])).toEqual([
      "Electives",
      "Electives",
      "Electives",
      "Lesson 1",
      "Lesson 2",
      "Lesson 3",
      "Lesson 4",
      "Lesson 5",
      "Capstone",
    ]);
    expect(order[9]).toBe("Start");
  });

  test("Enter on a Lesson to do goes to its preview and posts nothing", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/journey", atB4);
    screen.getByRole("link", { name: /^Lesson 5: .*, to do$/ }).focus();
    await user.keyboard("{Enter}");
    expect(page.router.state.location.pathname).toBe("/lesson/b-5");
    expect(
      await screen.findByRole("button", { name: "Open this lesson" }),
    ).toBeInTheDocument();
    expect(page.posts).toEqual([]);
  });

  test("the Next band goes to the active Lesson's route", () => {
    renderConnected("/journey", atB4);
    expect(
      screen.getByText("Beginner, Lesson 4:", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute(
      "href",
      "/lesson/b-4",
    );
  });

  test("after a complete Lesson, the band's Start opens the course's next", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/journey",
      snapshotOf(complete, { course: fullCourse }),
    );
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(page.posts).toEqual([{ type: "lesson.open", lesson: "b-4" }]);
  });

  test("with every Lesson complete, the band says so", () => {
    renderConnected(
      "/journey",
      snapshotOf(complete, { course: { ...fullCourse, next: null } }),
    );
    expect(screen.getByText("Every lesson is complete")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See your progress" }),
    ).toHaveAttribute("href", "/progress");
  });

  test("a snapshot with only its header shows only the title", () => {
    renderConnected("/journey", {
      instance: "e2e",
      revision: 1,
      milestones: [],
    } as unknown as Snapshot);
    expect(
      screen.getByRole("heading", { level: 1, name: "Learning journey" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});

describe("the Steps outline", () => {
  test("while playing, every step with its part and state, the current one marked", async () => {
    const user = userEvent.setup();
    renderConnected("/lesson/b-1/play", snapshotOf(playing));
    await user.click(screen.getByRole("button", { name: "Steps" }));
    const dialog = screen.getByRole("dialog", { name: "Steps" });
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(playing.steps.length);
    expect(items[0]).toHaveTextContent("Run the installer");
    expect(items[0]).toHaveTextContent("Worked exampledone");
    const current = items.filter(
      (item) => item.getAttribute("aria-current") === "step",
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(/^Check.*current$/);
  });

  test("before the Lesson starts, the outline says when it shows", async () => {
    const user = userEvent.setup();
    renderConnected("/lesson/b-4", atB4);
    await user.click(screen.getByRole("button", { name: "Steps" }));
    expect(
      within(screen.getByRole("dialog", { name: "Steps" })).getByText(
        "The step outline shows once the Lesson starts.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Your card", () => {
  const card = [
    {
      skill: "esc",
      show: "Esc",
      does: "Stops Claude mid-turn.",
      lesson: "b-1",
    },
    {
      skill: "version",
      show: "claude --version",
      does: "Prints the installed `claude` version.",
      lesson: "b-1",
    },
  ];
  const withCard = (): Snapshot => {
    const snapshot = snapshotOf(playing);
    return { ...snapshot, learner: { ...snapshot.learner, card } };
  };

  test("is absent while the card is empty", () => {
    renderConnected("/lesson/b-1/play", snapshotOf(playing));
    expect(
      screen.queryByRole("button", { name: "Your card" }),
    ).not.toBeInTheDocument();
  });

  test("lists the entries in order, then Commands by level, which opens the page panel; focus returns to Your card", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/play", withCard());
    await user.click(screen.getByRole("button", { name: "Your card" }));
    expect(page.pageFetches).toEqual([]);
    const dialog = screen.getByRole("dialog", { name: "Your card" });
    const items = within(dialog).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Stops Claude mid-turn."),
      expect.stringContaining("Prints the installed claude version."),
    ]);
    expect(items[0]).toHaveTextContent("Beginner · Lesson 1");
    expect(
      [...dialog.querySelectorAll("code")].map((code) => code.textContent),
    ).toEqual(["Esc", "claude --version", "claude"]);
    await user.click(
      within(dialog).getByRole("button", { name: "Commands by level" }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Commands by level",
      }),
    ).toBeInTheDocument();
    expect(page.pageFetches).toEqual([
      "/pages/index.json",
      "/pages/reference/commands.html",
    ]);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Your card" })).toHaveFocus();
    expect(page.posts).toEqual([]);
  });
});

describe("Electives", () => {
  test("list the Level's Electives only once opened, fetch nothing before and post nothing", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/journey", atB4);
    expect(page.pageFetches).toEqual([]);
    const summaries = screen.getAllByText("Electives");
    expect(summaries).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: "Keep notes with Claude" }),
    ).not.toBeInTheDocument();
    await user.click(summaries[0] as HTMLElement);
    await user.click(
      await screen.findByRole("button", { name: "Keep notes with Claude" }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Keep notes with Claude",
      }),
    ).toBeInTheDocument();
    expect(page.pageFetches).toEqual([
      "/pages/index.json",
      "/pages/beginner/electives/notes.html",
    ]);
    expect(page.posts).toEqual([]);
    // The Level tabs keep their names.
    expect(screen.getByRole("tab", { name: /^Beginner/ })).toHaveAccessibleName(
      expect.stringMatching(/^Beginner\d+ of \d+$/),
    );
  });
});
