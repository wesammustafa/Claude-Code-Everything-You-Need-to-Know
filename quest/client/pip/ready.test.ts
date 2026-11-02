import { afterEach, expect, test } from "vitest";
import { markPipReady, PIP_READY_MARK } from "./ready";

const ready = () => performance.getEntriesByName(PIP_READY_MARK, "mark");

afterEach(() => {
  performance.clearMarks(PIP_READY_MARK);
});

test("marks Pip ready once per page, keeping the first time", () => {
  expect(ready()).toHaveLength(0);
  markPipReady();
  const first = ready()[0]?.startTime;
  markPipReady();
  expect(ready()).toHaveLength(1);
  expect(ready()[0]?.startTime).toBe(first);
});
