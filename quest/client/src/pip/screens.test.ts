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
  ["/lesson/b-1/elsewhere", "other"],
  ["/nowhere", "other"],
])("%s is the %s screen", (path, screen) => {
  expect(screenFor(path)).toBe(screen);
});
