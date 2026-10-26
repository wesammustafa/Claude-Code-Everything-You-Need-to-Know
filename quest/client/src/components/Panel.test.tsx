import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { FixedLayer } from "./FixedLayer";
import { Panel } from "./Panel";

function Harness({ bar = false }: { bar?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open settings
      </button>
      {bar && (
        <FixedLayer>
          <footer data-testid="bar">
            <a href="#next">Next step</a>
          </footer>
        </FixedLayer>
      )}
      <Panel
        title="Settings"
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <a href="#theme">Theme</a>
      </Panel>
    </>
  );
}

function renderInRoot(bar = false) {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  return { root, ...render(<Harness bar={bar} />, { container: root }) };
}

test("opens a named dialog outside the page, focuses Close and makes the page inert", async () => {
  const user = userEvent.setup();
  const { root } = renderInRoot();
  await user.click(screen.getByRole("button", { name: "Open settings" }));

  const dialog = screen.getByRole("dialog", { name: "Settings" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(root).not.toContainElement(dialog);
  expect(root).toHaveAttribute("inert");
  expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  root.remove();
});

test("keeps Tab inside, closes on Escape and returns focus to the opener", async () => {
  const user = userEvent.setup();
  const { root } = renderInRoot();
  const opener = screen.getByRole("button", { name: "Open settings" });
  await user.click(opener);
  const close = screen.getByRole("button", { name: "Close" });

  await user.tab();
  expect(screen.getByRole("link", { name: "Theme" })).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole("link", { name: "Theme" })).toHaveFocus();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(root).not.toHaveAttribute("inert");
  expect(opener).toHaveFocus();
  root.remove();
});

test("closes from Close and from the scrim, but not from a click inside", async () => {
  const user = userEvent.setup();
  const { root } = renderInRoot();
  await user.click(screen.getByRole("button", { name: "Open settings" }));
  await user.click(screen.getByRole("dialog"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Open settings" }));
  const scrim = document.querySelector<HTMLElement>("[data-panel-scrim]");
  if (!scrim) throw new Error("no scrim");
  await user.click(scrim);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  root.remove();
});

test("makes the fixed layers beside the page inert too, even one that mounts while open", async () => {
  const user = userEvent.setup();
  const { root } = renderInRoot(true);
  // The bar is portaled into <body>, a sibling of #root.
  const footer = screen.getByTestId("bar");
  expect(footer.parentElement).toBe(document.body);
  await user.click(screen.getByRole("button", { name: "Open settings" }));
  const dialog = screen.getByRole("dialog", { name: "Settings" });

  expect(footer.closest("[inert]")).not.toBeNull();
  expect(dialog.closest("[inert]")).toBeNull();
  const late = document.createElement("div");
  document.body.append(late);
  await waitFor(() => {
    expect(late).toHaveAttribute("inert");
  });

  await user.keyboard("{Escape}");
  expect(footer.closest("[inert]")).toBeNull();
  expect(late).not.toHaveAttribute("inert");
  expect(root).not.toHaveAttribute("inert");
  late.remove();
  root.remove();
});

test("holds the page still: scroll locked, the scrollbar's width kept as padding", async () => {
  const user = userEvent.setup();
  const html = document.documentElement;
  // A classic scrollbar 15 px wide beside the page.
  Object.defineProperty(html, "clientWidth", {
    configurable: true,
    value: window.innerWidth - 15,
  });
  try {
    const { root } = renderInRoot();
    await user.click(screen.getByRole("button", { name: "Open settings" }));
    expect(html).toHaveAttribute("data-scroll-locked");
    expect(html.style.getPropertyValue("--scroll-lock-gap")).toBe("15px");

    await user.keyboard("{Escape}");
    expect(html).not.toHaveAttribute("data-scroll-locked");
    expect(html.style.getPropertyValue("--scroll-lock-gap")).toBe("");
    root.remove();
  } finally {
    Reflect.deleteProperty(html, "clientWidth");
  }
});
