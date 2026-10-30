import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { renderWithMotion, setMotionSwitch } from "../../test/motion";
import { expectStylesFromTokens } from "../../test/token-classes";
import { ProgressBar } from "./ProgressBar";

test("is a named progress bar with its values, and no live region", () => {
  const { container } = renderWithMotion(
    <ProgressBar value={3} max={9} label="Beginner progress" />,
  );
  const bar = screen.getByRole("progressbar", { name: "Beginner progress" });
  expect(bar).toHaveAttribute("aria-valuemin", "0");
  expect(bar).toHaveAttribute("aria-valuemax", "9");
  expect(bar).toHaveAttribute("aria-valuenow", "3");
  expect(container.querySelector("[aria-live], [role=status]")).toBeNull();
  expect(bar).toHaveClass("bg-surface-2", "shadow-track");
});

test.each([
  ["accent", "bg-accent-mark"],
  ["pass", "bg-pass"],
] as const)(
  "the %s fill slides in from the left, from tokens",
  (tone, fill) => {
    const { container } = renderWithMotion(
      <ProgressBar value={1} max={4} label="Progress" tone={tone} />,
    );
    const node = container.querySelector<HTMLElement>("[data-fill]");
    // It slides, never scales, so its rounded end keeps its shape.
    expect(node).toHaveClass(fill, "rounded-full");
    expect(node?.style.transform).toMatch(/translateX\(-100%\)/);
    expect(node?.style.transform).not.toMatch(/scale/);
    for (const el of container.querySelectorAll("[class]"))
      expectStylesFromTokens(el.getAttribute("class") ?? "");
  },
);

test("under reduced motion the fill sits at its width and only fades", async () => {
  await setMotionSwitch("reduce");
  const { container } = renderWithMotion(
    <ProgressBar value={1} max={4} label="Progress" />,
  );
  const node = container.querySelector<HTMLElement>("[data-fill]");
  expect(node?.style.width).toBe("25%");
  expect(node?.style.transform).toBe("");
  expect(node?.style.opacity).toBe("0");
});

test("an empty or overfull bar stays inside its track", async () => {
  await setMotionSwitch("reduce");
  const { container, rerender } = renderWithMotion(
    <ProgressBar value={0} max={0} label="Progress" />,
  );
  const width = () =>
    container.querySelector<HTMLElement>("[data-fill]")?.style.width;
  expect(width()).toBe("0%");
  rerender(<ProgressBar value={12} max={9} label="Progress" />);
  expect(width()).toBe("100%");
});

test("its value stays inside its range, as the fill does", () => {
  const { rerender } = renderWithMotion(
    <ProgressBar value={12} max={9} label="Progress" />,
  );
  const bar = screen.getByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuenow", "9");
  rerender(<ProgressBar value={-2} max={9} label="Progress" />);
  expect(bar).toHaveAttribute("aria-valuenow", "0");
});

test("is phrasing content, so a button may hold it", () => {
  const { container } = renderWithMotion(
    <ProgressBar value={1} max={4} label="Progress" />,
  );
  for (const el of container.querySelectorAll("*"))
    expect(el.tagName).toBe("SPAN");
});
