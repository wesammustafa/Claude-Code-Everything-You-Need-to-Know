import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { PIP_ICON_PARTS } from "./icon";
import { Pip } from "./Pip";

test("the icon size is Pip's static icon, never the rig or a poster", () => {
  const { container } = render(<Pip size="icon" />);
  const icon = container.querySelector("svg[data-pip-icon]");
  expect(icon).toHaveAttribute("aria-hidden", "true");
  expect(icon?.getAttribute("class")).toContain("size-6");
  expect(
    [...container.querySelectorAll("path")].map((p) => p.getAttribute("d")),
  ).toEqual(PIP_ICON_PARTS.map((part) => part.d));
  expect(container.querySelector("canvas, img, [data-pip]")).toBeNull();
});

test("the icon takes every colour from tokens", () => {
  const { container } = render(<Pip size="icon" />);
  for (const el of container.querySelectorAll("svg, path"))
    expectStylesFromTokens(el.getAttribute("class") ?? "");
});

test.each(["beside", "hero"] as const)(
  "the %s size is Pip drawn at that size, not the icon",
  (size) => {
    const { container } = render(<Pip size={size} className="mb-2" />);
    expect(container.querySelector("[data-pip-icon]")).toBeNull();
    const pip = container.querySelector("[data-pip]");
    expect(pip).toHaveAttribute("data-pip", size);
    expect(pip).toHaveAttribute("aria-hidden", "true");
    expect(pip?.className).toContain("mb-2");
    expect(pip?.querySelector("img")?.getAttribute("src")).toMatch(
      new RegExp(`idle-${size}`),
    );
  },
);
