import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, test, vi } from "vitest";
import {
  expectStylesFromTokens,
  stateUtilities,
} from "../../test/token-classes";
import {
  Button,
  ButtonLink,
  buttonClasses,
  type ButtonVariant,
} from "./Button";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost"];

describe("Button", () => {
  test("is a button named by its label, operated from the keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Check again</Button>);
    const button = screen.getByRole("button", { name: "Check again" });
    expect(button).toHaveAttribute("type", "button");

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  test("when disabled, is skipped by Tab and ignores clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button disabled onClick={onClick}>
          Checking
        </Button>
        <Button>Skip</Button>
      </>,
    );
    const disabled = screen.getByRole("button", { name: "Checking" });
    expect(disabled).toBeDisabled();
    await user.click(disabled);
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(screen.getByRole("button", { name: "Skip" })).toHaveFocus();
  });

  test.each(VARIANTS)("%s draws every state from tokens", (variant) => {
    for (const size of ["sm", "md", "lg"] as const) {
      const classes = buttonClasses(variant, size);
      expectStylesFromTokens(classes);

      // Hover and pressed change colour only while not disabled.
      const hover = stateUtilities(classes, "hover");
      expect(hover.length).toBeGreaterThan(0);
      expect(
        classes
          .split(" ")
          .filter((u) => u.includes("hover:") || u.includes("active:"))
          .every((u) => u.startsWith("not-disabled:")),
      ).toBe(true);

      const pressed = stateUtilities(classes, "active");
      expect(pressed).toEqual(
        expect.arrayContaining([
          "duration-(--duration-press)",
          "translate-y-(--press-y)",
          "scale-(--press-scale)",
        ]),
      );
      expect(pressed.some((u) => u.startsWith("bg-"))).toBe(true);

      expect(stateUtilities(classes, "focus-visible")).toEqual(
        expect.arrayContaining([
          "outline-2",
          "outline-offset-2",
          "outline-focus",
        ]),
      );
      expect(stateUtilities(classes, "disabled")).toEqual(
        expect.arrayContaining(["opacity-disabled", "cursor-not-allowed"]),
      );
    }
  });

  test("renders its variant, size and icons", () => {
    render(
      <Button variant="primary" size="lg" icon="check" iconEnd="arrow">
        Next step
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Next step" });
    expect(button.className).toContain("bg-accent");
    expect(button.className).toContain("h-12");
    expect(button.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(2);
  });

  test.each(VARIANTS)(
    "%s, while its action is in flight, holds the pressed state and is busy",
    (variant) => {
      const { rerender } = render(
        <Button variant={variant}>Check again</Button>,
      );
      const button = screen.getByRole("button", { name: "Check again" });
      expect(button).not.toHaveAttribute("aria-busy");
      expect(button).not.toHaveAttribute("data-pending");
      expect(button.className).not.toContain("data-pending:");

      rerender(
        <Button variant={variant} pending>
          Check again
        </Button>,
      );
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("data-pending", "");
      const held = button.className
        .split(/\s+/)
        .filter((name) => name.startsWith("data-pending:"))
        .map((name) => name.slice("data-pending:".length));
      const pressed = stateUtilities(button.className, "active");
      // The same look pressing gives: its fill and its travel.
      for (const utility of held) expect(pressed).toContain(utility);
      expect(held).toEqual(
        expect.arrayContaining([
          "translate-y-(--press-y)",
          "scale-(--press-scale)",
        ]),
      );
      expectStylesFromTokens(button.className);
    },
  );
});

describe("ButtonLink", () => {
  test("is a link drawn as a button, with hover and pressed states but no disabled one", async () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <ButtonLink to="/next" variant="primary">
            Start
          </ButtonLink>
        ),
      },
      { path: "/next", element: <p>Next screen</p> },
    ]);
    render(<RouterProvider router={router} />);
    const link = screen.getByRole("link", { name: "Start" });
    expectStylesFromTokens(link.className);
    expect(stateUtilities(link.className, "hover")).toContain(
      "bg-accent-hover",
    );
    expect(stateUtilities(link.className, "active")).toContain(
      "bg-accent-pressed",
    );
    expect(stateUtilities(link.className, "disabled")).toEqual([]);

    const user = userEvent.setup();
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Next screen")).toBeInTheDocument();
  });
});
