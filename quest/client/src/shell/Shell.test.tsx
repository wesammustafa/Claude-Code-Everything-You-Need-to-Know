import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, test } from "vitest";
import { complete, overview, playing, snapshotOf } from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";
import { routes } from "../routes";

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
    renderAt("/lesson/b-3");
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(
      within(where).getByRole("link", { name: "Beginner" }),
    ).toHaveAttribute("href", "/journey");
    expect(
      within(where).getByRole("link", { name: "Lesson 3" }),
    ).toHaveAttribute("href", "/lesson/b-3");
    await user.click(within(where).getByRole("button", { name: "Steps" }));
    expect(screen.getByRole("dialog", { name: "Steps" })).toBeInTheDocument();
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
    renderAt("/journey");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Beginner0 of 6",
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
        name: "Lesson 1: Turn a repeated workflow into a skill",
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
  });

  test("the current Lesson's crumb marks the page it names, and only there", () => {
    renderAt("/lesson/b-3");
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(
      within(where).getByRole("link", { name: "Lesson 3" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(where).getByRole("link", { name: "Beginner" }),
    ).not.toHaveAttribute("aria-current");
  });

  test("in the workspace, the Lesson's crumb is a way back, not the current page", () => {
    renderAt("/lesson/b-3/step");
    const where = screen.getByRole("navigation", { name: "Where you are" });
    expect(
      within(where).getByRole("link", { name: "Lesson 3" }),
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
