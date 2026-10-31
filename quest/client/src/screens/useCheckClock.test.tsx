import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { BeatView } from "@quest/contract";
import { useCheckClock } from "./useCheckClock";

function Clock({ status }: { status: BeatView["status"] }) {
  const seconds = useCheckClock(status);
  return (
    <span data-testid="clock">{seconds === null ? "" : String(seconds)}</span>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const clock = () => screen.getByTestId("clock").textContent;
const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

test("shows nothing for a Check under 3 s", () => {
  render(<Clock status="checking" />);
  advance(2900);
  expect(clock()).toBe("");
});

test("counts from 3 s every second to 10 s, then every 5 s", () => {
  render(<Clock status="checking" />);
  advance(3000);
  expect(clock()).toBe("3");
  const seen: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    advance(1000);
    seen.push(clock());
  }
  expect(seen).toEqual(["4", "5", "6", "7", "8", "9", "10"]);
  advance(4999);
  expect(clock()).toBe("10");
  advance(1);
  expect(clock()).toBe("15");
  advance(5000);
  expect(clock()).toBe("20");
});

test("stops on the result and starts again from nothing on the next Check", () => {
  const { rerender } = render(<Clock status="checking" />);
  advance(5000);
  expect(clock()).toBe("5");
  rerender(<Clock status="fail" />);
  expect(clock()).toBe("");
  advance(10000);
  expect(clock()).toBe("");
  rerender(<Clock status="checking" />);
  expect(clock()).toBe("");
  advance(2999);
  expect(clock()).toBe("");
  advance(1);
  expect(clock()).toBe("3");
});
