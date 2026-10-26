import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { PIP_ICON_PARTS } from "./icon";
import { Pip } from "./Pip";

test("the icon size is Pip's static icon, never the rig or the placeholder", () => {
  const { container } = render(<Pip size="icon" />);
  const icon = container.querySelector("svg[data-pip-icon]");
  expect(icon).toHaveAttribute("aria-hidden", "true");
  expect(icon?.getAttribute("class")).toContain("size-6");
  expect(
    [...container.querySelectorAll("path")].map((p) => p.getAttribute("d")),
  ).toEqual(PIP_ICON_PARTS.map((part) => part.d));
  expect(container.querySelector("canvas, img")).toBeNull();
  expect(container.querySelector("[data-pip-placeholder]")).toBeNull();
});

test("the icon takes every colour from tokens", () => {
  const { container } = render(<Pip size="icon" />);
  for (const el of container.querySelectorAll("svg, path"))
    expectStylesFromTokens(el.getAttribute("class") ?? "");
});

test.each(["beside", "hero"] as const)(
  "the %s size is not the icon",
  (size) => {
    const { container } = render(<Pip size={size} />);
    expect(container.querySelector("[data-pip-icon]")).toBeNull();
    expect(container.querySelector("[data-pip-placeholder]")).toHaveAttribute(
      "data-pip-placeholder",
      size,
    );
  },
);
