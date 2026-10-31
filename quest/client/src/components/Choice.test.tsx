import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { renderWithMotion, setMotionSwitch } from "../../test/motion";
import {
  expectStylesFromTokens,
  stateUtilities,
} from "../../test/token-classes";
import { Choice, type ChoiceProps } from "./Choice";

const OPTIONS = [
  {
    id: "a",
    text: "It reads CLAUDE.md",
    because: "Claude Code reads it at the start of a session.",
  },
  { id: "b", text: "It reads every file", because: "Only the files it needs." },
  { id: "c", text: "It reads nothing" },
];

function Harness(props: Partial<ChoiceProps>) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Choice
      legend="What does Claude Code read first?"
      options={OPTIONS}
      value={value}
      onChange={setValue}
      {...props}
    />
  );
}

test("is a named group of radios, answered from the keyboard", async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  const group = screen.getByRole("group", {
    name: "What does Claude Code read first?",
  });
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(3);
  expect(group).toContainElement(radios[0] ?? null);
  // The A, B, C keys are drawn for the eye only.
  expect(screen.getByRole("radio", { name: "It reads CLAUDE.md" })).toBe(
    radios[0],
  );
  await user.tab();
  expect(radios[0]).toHaveFocus();
  await user.keyboard(" ");
  expect(radios[0]).toBeChecked();
  await user.keyboard("{ArrowDown}");
  expect(radios[1]).toBeChecked();
  expect(container.querySelector("[data-state=picked]")).toHaveTextContent(
    "It reads every file",
  );
  const label = radios[1]?.closest("label");
  expect(stateUtilities(label?.className ?? "", "has-focus-visible")).toEqual(
    expect.arrayContaining(["outline-2", "outline-offset-2", "outline-focus"]),
  );
});

test("marks a right answer green and opens its reason", () => {
  const { container } = renderWithMotion(
    <Choice
      legend="Q"
      options={OPTIONS}
      value="a"
      onChange={() => undefined}
      result={{ id: "a", state: "right" }}
    />,
  );
  const right = container.querySelector("[data-state=right]");
  expect(right).toHaveClass("border-pass", "bg-pass-soft");
  expect(right).toHaveTextContent("Right");
  expect(
    screen.getByText("Claude Code reads it at the start of a session."),
  ).toBeInTheDocument();
  expect(screen.queryByText("Only the files it needs.")).toBeNull();
});

test("marks an answer not right yet in amber with Not yet, never red, and adds no live region", () => {
  const { container } = renderWithMotion(
    <Choice
      legend="Q"
      options={OPTIONS}
      value="b"
      onChange={() => undefined}
      result={{ id: "b", state: "notYet" }}
    />,
  );
  const notYet = container.querySelector("[data-state=notYet]");
  expect(notYet).toHaveClass("border-wait", "bg-wait-soft");
  expect(notYet).toHaveTextContent("Not yet");
  expect(container.innerHTML).not.toMatch(/broken/);
  expect(container.querySelector("[aria-live], [role=status]")).toBeNull();
  for (const node of container.querySelectorAll("[class]"))
    expectStylesFromTokens(node.getAttribute("class") ?? "");
});

test("disabled, takes no answer", async () => {
  const user = userEvent.setup();
  render(<Harness disabled />);
  await user.click(screen.getByText("It reads nothing"));
  expect(
    screen.getByRole("radio", { name: "It reads nothing" }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("radio", { name: "It reads nothing" }),
  ).toBeDisabled();
});

test("its reason opens through its height, or under reduced motion only fades", async () => {
  const marked = (
    <Choice
      legend="Q"
      options={OPTIONS}
      value="a"
      onChange={() => undefined}
      result={{ id: "a", state: "right" }}
    />
  );
  const full = renderWithMotion(marked);
  const style = () =>
    document.querySelector<HTMLElement>("[data-because]")?.style;
  expect(style()?.height).toBe("0px");
  full.unmount();
  await setMotionSwitch("reduce");
  renderWithMotion(marked);
  expect(style()?.height).toBe("");
  expect(style()?.opacity).toBe("0");
});

test("its words keep the copy rules", () => {
  const { container } = renderWithMotion(
    <>
      <Choice
        legend="Q"
        options={OPTIONS}
        value="a"
        onChange={() => undefined}
        result={{ id: "a", state: "right" }}
      />
      <Choice
        legend="Q"
        options={OPTIONS}
        value="b"
        onChange={() => undefined}
        result={{ id: "b", state: "notYet" }}
      />
    </>,
  );
  // The words Choice adds of its own: the marks beside the answers.
  const own = [...container.querySelectorAll("label > span.text-sm")]
    .map((s) => s.textContent)
    .join(" ");
  expect(own).toBe("Right Not yet");
  expect(own).not.toMatch(/key|press|stuck|wrong|fail/i);
  expect(container.textContent).not.toContain(String.fromCodePoint(0x2014));
});
