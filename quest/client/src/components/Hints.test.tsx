import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Hints } from "./Hints";

const HINTS = ["Look in `src/`.", "Open the newest file."];

test("shows one rung at a time, the newest as Pip's hint target", async () => {
  const user = userEvent.setup();
  const onShowNext = vi.fn();
  const { container, rerender } = render(
    <Hints hints={HINTS} shown={0} onShowNext={onShowNext} />,
  );
  expect(container.querySelector("[data-pip-target]")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Show a hint" }));
  expect(onShowNext).toHaveBeenCalledOnce();

  rerender(<Hints hints={HINTS} shown={1} onShowNext={onShowNext} />);
  expect(container).toHaveTextContent("Hint 1. Look in src/.");
  expect(screen.getByRole("button", { name: "Another hint" })).toBeVisible();

  rerender(<Hints hints={HINTS} shown={2} onShowNext={onShowNext} />);
  const targets = container.querySelectorAll("[data-pip-target=hint]");
  expect(targets).toHaveLength(1);
  expect(targets[0]).toHaveTextContent("Hint 2. Open the newest file.");
  expect(screen.queryByRole("button")).toBeNull();
});
