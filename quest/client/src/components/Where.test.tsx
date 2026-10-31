import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { Where, type WhereKind } from "./Where";

test.each<WhereKind>([
  "terminal",
  "claude",
  "claude-2",
  "shell",
  "editor",
  "browser",
])("%s shows its icon, the place in bold and the note", (kind) => {
  const { container } = render(
    <Where kind={kind} label="Your terminal" note="in your Practice copy" />,
  );
  const where = container.querySelector(`[data-where="${kind}"]`);
  expect(where?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(where?.querySelector("b")).toHaveTextContent("Your terminal");
  expect(where).toHaveTextContent(
    "Your terminal in your Practice copy".replace(" in", "in"),
  );
  for (const node of container.querySelectorAll("[class]"))
    expectStylesFromTokens(node.getAttribute("class") ?? "");
});

test("numbers the second of a kind, and shows no note it was not given", () => {
  const { container } = render(
    <Where kind="claude-2" label="Claude Code" number={2} />,
  );
  expect(container.querySelector("b")).toHaveTextContent("Claude Code 2");
  expect(container.querySelector(".text-muted")).toBeNull();
});
