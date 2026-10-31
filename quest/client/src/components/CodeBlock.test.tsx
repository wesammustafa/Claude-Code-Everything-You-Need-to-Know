import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { CodeBlock } from "./CodeBlock";

afterEach(() => {
  vi.restoreAllMocks();
});

const CODE = {
  lines: [
    { n: 4, text: "const a = 1;" },
    {
      n: 5,
      text: "const b = a + 1; // a long line that wraps under its own number",
    },
    { n: 6, text: "export { b };" },
  ],
  point: 5,
  copy: "const z = 0;\nconst a = 1;\nconst b = a + 1;\nexport { b };\n",
};

test("shows the window under each line's number in the whole block", () => {
  const { container } = render(<CodeBlock code={CODE} />);
  const lines = [...container.querySelectorAll("[data-line]")];
  expect(lines.map((line) => line.getAttribute("data-line"))).toEqual([
    "4",
    "5",
    "6",
  ]);
  expect(container).not.toHaveTextContent("const z");
  for (const node of container.querySelectorAll("[class]"))
    expectStylesFromTokens(node.getAttribute("class") ?? "");
});

test("marks the explained line for the eye and for a screen reader", () => {
  const { container } = render(<CodeBlock code={CODE} />);
  const point = container.querySelectorAll("[data-point]");
  expect(point).toHaveLength(1);
  expect(point[0]).toHaveAttribute("data-line", "5");
  expect(point[0]).toHaveTextContent("explained line");
});

test("one Copy copies the whole block", async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText");
  render(<CodeBlock code={CODE} />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Copy the code" }));
  expect(writeText).toHaveBeenCalledWith(CODE.copy);
  expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
});
