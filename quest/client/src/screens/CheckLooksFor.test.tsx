import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { CheckLooksFor } from "./CheckLooksFor";

test("renders nothing without check items", () => {
  const { container } = render(<CheckLooksFor items={[]} />);
  expect(container).toBeEmptyDOMElement();
});

test("starts closed, counts the items and lists them once opened", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <CheckLooksFor
      items={["`notes.md` names the model", "the session ends"]}
    />,
  );
  const details = container.querySelector("details");
  expect(details).not.toHaveAttribute("open");
  expect(screen.getByText(", 2 checks")).toBeInTheDocument();
  await user.click(screen.getByText("What the check looks for"));
  expect(details).toHaveAttribute("open");
  const items = container.querySelectorAll("[data-check-items] li");
  expect(items).toHaveLength(2);
  expect(items[0]?.querySelector("code")).toHaveTextContent("notes.md");
});

test("counts a single item in the singular", () => {
  render(<CheckLooksFor items={["the session ends"]} />);
  expect(screen.getByText(", 1 check")).toBeInTheDocument();
});
