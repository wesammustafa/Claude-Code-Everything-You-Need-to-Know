import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { renderWithMotion, setMotionSwitch } from "../../test/motion";
import { expectStylesFromTokens } from "../../test/token-classes";
import { Badge, type BadgeShape } from "./Badge";

test.each<BadgeShape>(["circle", "hexagon", "shield"])(
  "the %s shape, earned, is an image named by the badge, drawn in coral",
  (shape) => {
    renderWithMotion(<Badge shape={shape} earned name="Explorer" />);
    const badge = screen.getByRole("img", { name: "Explorer" });
    expect(badge).toHaveAttribute("viewBox", "0 0 64 64");
    expect(badge).toHaveClass("text-accent-mark");
    expect(badge.querySelector("[stroke-dasharray]")).toBeNull();
    expectStylesFromTokens(badge.getAttribute("class") ?? "");
  },
);

test("not yet earned: a dashed outline in the mark colour, never a lock, and said so", () => {
  renderWithMotion(<Badge shape="circle" earned={false} name="Explorer" />);
  const badge = screen.getByRole("img", { name: "Explorer, not yet" });
  expect(badge).toHaveClass("text-mark");
  expect(badge.querySelector("[stroke-dasharray]")).not.toBeNull();
  expect(badge.innerHTML).not.toMatch(/lock/i);
});

test("a capstone is a quarter larger, with an inner ring", () => {
  const { container } = renderWithMotion(
    <>
      <Badge shape="shield" earned name="Plain" size="lg" />
      <Badge shape="shield" earned capstone name="Capstone" size="lg" />
      <Badge shape="shield" earned capstone name="Small" size="sm" />
    </>,
  );
  expect(screen.getByRole("img", { name: "Plain" })).toHaveClass("size-16");
  const capstone = screen.getByRole("img", { name: "Capstone" });
  expect(capstone).toHaveClass("size-20");
  expect(screen.getByRole("img", { name: "Small" })).toHaveClass("size-15");
  expect(capstone.querySelector("[transform*='scale(.78)']")).not.toBeNull();
  expect(container.querySelectorAll("path")).toHaveLength(5);
});

test("carries the Lesson's symbol at its centre", () => {
  renderWithMotion(
    <Badge
      shape="circle"
      earned
      name="Explorer"
      symbol={<circle data-testid="symbol" cx="12" cy="12" r="8.5" />}
    />,
  );
  expect(screen.getByTestId("symbol").parentElement).toHaveAttribute(
    "transform",
    "translate(20 20)",
  );
});

test("revealed, it pops from --pop-from; at rest, or under reduced motion, it does not move", async () => {
  const shape = () =>
    document.querySelector<SVGGElement>("[data-badge-shape]")?.style;
  const revealed = renderWithMotion(
    <Badge shape="circle" earned name="Explorer" reveal />,
  );
  expect(shape()?.transform).toMatch(/scale\(0\.6\)/);
  revealed.unmount();

  const still = renderWithMotion(
    <Badge shape="circle" earned name="Explorer" />,
  );
  expect(shape()?.transform ?? "").not.toMatch(/scale|translate/);
  still.unmount();

  await setMotionSwitch("reduce");
  renderWithMotion(<Badge shape="circle" earned name="Explorer" reveal />);
  expect(shape()?.transform ?? "").not.toMatch(/scale|translate/);
  expect(shape()?.opacity).toBe("0");
});

test("its words keep the copy rules", () => {
  renderWithMotion(
    <Badge shape="hexagon" earned={false} capstone name="Organizer" />,
  );
  const name = screen.getByRole("img").getAttribute("aria-label") ?? "";
  expect(name).not.toMatch(/key|press|stuck|wrong|fail|locked/i);
  expect(name).not.toContain(String.fromCodePoint(0x2014));
});
