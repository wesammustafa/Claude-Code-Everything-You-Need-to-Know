import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FIRST_PAINT_WAIT_MS, afterFirstPaint } from "./paint";

const FRAME_MS = 16;
let entries: string[] = [];

beforeEach(() => {
  entries = [];
  vi.useFakeTimers({
    toFake: [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "setTimeout",
      "clearTimeout",
    ],
  });
  vi.spyOn(performance, "getEntriesByName").mockImplementation((name: string) =>
    entries
      .filter((entry) => entry === name)
      .map((entry) => ({ name: entry }) as PerformanceEntry),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A browser that keeps paint timing. */
function paintTiming() {
  vi.stubGlobal(
    "PerformanceObserver",
    Object.assign(() => undefined, { supportedEntryTypes: ["paint"] }),
  );
}

describe("afterFirstPaint", () => {
  test("waits for the browser to record the first contentful paint, then runs after that frame", () => {
    paintTiming();
    const run = vi.fn();
    afterFirstPaint(run);
    vi.advanceTimersByTime(FRAME_MS * 5);
    entries.push("first-paint");
    vi.advanceTimersByTime(FRAME_MS * 5);
    expect(run).not.toHaveBeenCalled();
    entries.push("first-contentful-paint");
    vi.advanceTimersByTime(FRAME_MS * 2);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(FRAME_MS * 10);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("runs at once when the paint was recorded before it was asked", () => {
    paintTiming();
    entries.push("first-contentful-paint");
    const run = vi.fn();
    afterFirstPaint(run);
    vi.advanceTimersByTime(FRAME_MS * 2);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("goes ahead when no paint is recorded within the wait", () => {
    paintTiming();
    const run = vi.fn();
    afterFirstPaint(run);
    vi.advanceTimersByTime(FIRST_PAINT_WAIT_MS - FRAME_MS * 2);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FRAME_MS * 4);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("without paint timing, runs after the next frame", () => {
    vi.stubGlobal("PerformanceObserver", undefined);
    const run = vi.fn();
    afterFirstPaint(run);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FRAME_MS * 2);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test("never runs once cancelled", () => {
    paintTiming();
    const run = vi.fn();
    const cancel = afterFirstPaint(run);
    vi.advanceTimersByTime(FRAME_MS * 2);
    cancel();
    entries.push("first-contentful-paint");
    vi.advanceTimersByTime(FIRST_PAINT_WAIT_MS * 2);
    expect(run).not.toHaveBeenCalled();
  });
});
