import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BOARD_SECTIONS, BOARD_URL, resetBoardForTests } from "./board";
import { Playground } from "./Playground";

// The runtime is the browser's (WebGL2, WASM): here it never settles, so every
// Pip keeps its poster.
vi.mock("../pip/runtime", () => ({
  settledPipRuntime: () => undefined,
  subscribePipRuntime: () => () => undefined,
  loadPipRuntime: () => new Promise(() => undefined),
}));

function boardAnswers(ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(null, { status: ok ? 200 : 404 })),
    ),
  );
}

beforeEach(() => {
  resetBoardForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Playground's controls", () => {
  test("a range's readout is not a live region: the range alone announces its value", () => {
    boardAnswers(true);
    const { container } = render(<Playground />);
    expect(screen.getByRole("slider", { name: "Intensity" })).toBeVisible();
    expect(container.querySelector("output")).toBeNull();
    expect(screen.queryAllByRole("status")).toEqual([]);
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  test("the intensity presets are a named group, and each names what it sets", () => {
    boardAnswers(true);
    render(<Playground />);
    const presets = screen.getByRole("group", { name: "Intensity presets" });
    const names = within(presets)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual([
      "Intensity 0.2",
      "Intensity 0.3",
      "Intensity 0.4",
      "Intensity 0.5",
      "Intensity 0.7",
      "Intensity 0.85",
      "Intensity 0.9",
      "Intensity 1",
    ]);
    expect(
      screen.getByRole("button", { name: "Intensity 0.5", pressed: false }),
    ).toHaveTextContent("0.5");
  });
});

describe("the approved board", () => {
  test("shows every crop, cut from the board in the browser", async () => {
    boardAnswers(true);
    const { container } = render(<Playground />);
    const crops = BOARD_SECTIONS.flatMap((section) => section.crops);
    await waitFor(() => {
      expect(screen.getAllByRole("img", { name: /^Pip: / })).toHaveLength(
        crops.length,
      );
    });
    const sources = new Set(
      [...container.querySelectorAll("svg image")].map((image) =>
        image.getAttribute("href"),
      ),
    );
    expect([...sources]).toEqual([BOARD_URL]);
    // Pip's posters are images; no image of the board's is.
    expect(
      container.querySelector('img[src*="board"], img[src$=".webp"]'),
    ).toBeNull();
    expect(screen.queryByText("Board not available")).toBeNull();
  });

  test("where the board is not on this machine, says so calmly in its place", async () => {
    boardAnswers(false);
    const { container } = render(<Playground />);
    await waitFor(() => {
      expect(
        container.querySelector('[data-playground-board="missing"]'),
      ).not.toBeNull();
    });
    expect(screen.queryAllByRole("img", { name: /board|Pip: / })).toEqual([]);
    expect(container.querySelector("svg image")).toBeNull();
    expect(screen.getAllByText("Board not available").length).toBeGreaterThan(
      0,
    );
  });
});
