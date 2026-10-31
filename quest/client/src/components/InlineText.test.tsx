import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { InlineText } from "./InlineText";

const open = vi.fn();
vi.mock("../pages/PagePanel", () => ({ usePagePanel: () => ({ open }) }));

beforeEach(() => {
  open.mockClear();
});

test("shows backticks as code and double stars as bold", () => {
  const { container } = render(
    <p>
      <InlineText text="Run `claude` and read **every** line." />
    </p>,
  );
  expect(container.querySelector("code")).toHaveTextContent("claude");
  expect(container.querySelector("strong")).toHaveTextContent("every");
  expect(container.querySelector("p")).toHaveTextContent(
    "Run claude and read every line.",
  );
});

test("a web link opens in a new tab", () => {
  render(
    <InlineText text="See [the docs](https://code.claude.com/docs/en/overview)." />,
  );
  const link = screen.getByRole("link", { name: "the docs" });
  expect(link).toHaveAttribute(
    "href",
    "https://code.claude.com/docs/en/overview",
  );
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("a repository page opens in the page panel, at its heading", async () => {
  const user = userEvent.setup();
  render(
    <InlineText text="Read [Lesson 2](beginner/02-first-session.md#why) first." />,
  );
  const link = screen.getByRole("link", { name: "Lesson 2" });
  expect(link).not.toHaveAttribute("target");
  await user.click(link);
  expect(open).toHaveBeenCalledWith("beginner/02-first-session.md", "why");
});

test("other links and HTML stay text", () => {
  const { container } = render(
    <InlineText text="[x](javascript:alert(1)) [up](../README.md) <b>hi</b>" />,
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
  expect(container).toHaveTextContent("<b>hi</b>");
});
