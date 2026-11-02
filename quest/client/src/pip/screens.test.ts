import { expect, test } from "vitest";
import { screenFor } from "./screens";

test.each([
  ["/", "welcome"],
  ["/journey", "map"],
  ["/lesson/b-1", "intro"],
  ["/lesson/b-1/", "intro"],
  ["/lesson/b-1/step", "step"],
  ["/lesson/a-capstone/complete", "complete"],
  ["/progress", "progress"],
  ["/level/b/complete", "levelComplete"],
  ["/level/a/complete/", "levelComplete"],
  ["/course/complete", "courseComplete"],
  ["/lesson/b-1/elsewhere", "other"],
  ["/nowhere", "other"],
])("%s is the %s screen", (path, screen) => {
  expect(screenFor(path)).toBe(screen);
});

test.each([
  ["/lesson/b-1/step", "step-down", "levelup"],
  ["/lesson/b-1/step/", "step-down", "levelup"],
  ["/lesson/b-1/step", "playing", "step"],
  ["/lesson/b-1/step", undefined, "step"],
  ["/lesson/b-1", "step-down", "intro"],
  ["/lesson/b-1/complete", "step-down", "complete"],
])("%s in phase %s is the %s screen", (path, phase, screen) => {
  expect(screenFor(path, phase)).toBe(screen);
});
