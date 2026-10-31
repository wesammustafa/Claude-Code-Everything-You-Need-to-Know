import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeEventSource, fakeFetch, type FakeAnswer } from "../../test/live";
import { routes } from "../routes";
import { WAITING_MS } from "../shell/Shell";
import { BACKOFF_MAX_MS, NOTICE_MS, STOPPED_MS } from "./stream";

let health: FakeAnswer;

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

const snapshot = { instance: "a", revision: 1, milestones: [] };
const region = () =>
  document.querySelector<HTMLElement>("[data-notice-region]");
const frame = () => document.querySelector<HTMLElement>("[data-screen]");

async function pass(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  FakeEventSource.reset();
  health = { status: 200, body: { ok: true, instance: "a" } };
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("fetch", fakeFetch(() => health).fetch);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the connection on screen", () => {
  test("one polite live region carries Reconnecting, then Stopped, and a reconnect clears it quietly", async () => {
    renderAt("/journey");
    await pass(0);
    act(() => {
      FakeEventSource.last.emit("snapshot", snapshot);
      FakeEventSource.last.fail();
    });
    const live = region();
    expect(live).toHaveAttribute("aria-live", "polite");
    await pass(NOTICE_MS - 1);
    expect(live).toBeEmptyDOMElement();
    await pass(1);
    expect(live).toHaveTextContent("Reconnecting to Claude Code Quest");
    expect(screen.getAllByRole("status")).toContain(live);

    health = "fail";
    await pass(STOPPED_MS - NOTICE_MS);
    expect(region()).toBe(live);
    expect(live).toHaveTextContent("Claude Code Quest stopped.");
    expect(live).toHaveTextContent("npm run learn");
    expect(screen.getByRole("button", { name: /Copy/ })).toBeInTheDocument();

    await pass(BACKOFF_MAX_MS);
    act(() => {
      FakeEventSource.last.emit("snapshot", snapshot);
    });
    expect(region()).toBe(live);
    expect(live).toBeEmptyDOMElement();
  });

  test("the screen is marked waiting only once the first snapshot is 150 ms late", async () => {
    renderAt("/journey");
    await pass(WAITING_MS - 1);
    expect(frame()).not.toHaveAttribute("data-connection");
    expect(frame()).not.toHaveAttribute("aria-busy");
    await pass(1);
    expect(frame()).toHaveAttribute("data-connection", "waiting");
    expect(frame()).toHaveAttribute("aria-busy", "true");
    act(() => {
      FakeEventSource.last.emit("snapshot", snapshot);
    });
    expect(frame()).not.toHaveAttribute("data-connection");
    expect(frame()).not.toHaveAttribute("aria-busy");
  });

  test("a snapshot that comes at once shows no waiting state", async () => {
    renderAt("/journey");
    await pass(0);
    act(() => {
      FakeEventSource.last.emit("snapshot", snapshot);
    });
    await pass(WAITING_MS * 2);
    expect(frame()).not.toHaveAttribute("data-connection");
    expect(region()).toBeEmptyDOMElement();
  });

  test("the stream closes when the page unmounts", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/journey"] });
    const { unmount } = render(<RouterProvider router={router} />);
    await pass(0);
    const source = FakeEventSource.last;
    unmount();
    expect(source.closed).toBe(true);
  });
});
