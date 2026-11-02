// Motion never changes or moves the words (rehoming row 218, learn-motion:273):
// Says, CheckLines, Hints and Notice show their whole text on the first
// render, before any timer runs, and the styles motion writes on their
// elements touch only opacity and transform (a hint rung's reveal also
// grows its box's height).
import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";
import { renderWithMotion } from "../../test/motion";
import { CheckLines } from "./CheckLines";
import { Hints } from "./Hints";
import { Notice } from "./Notice";
import { Says } from "./Says";

/** Inline style properties motion may write: opacity, transform and their helpers. */
const MOTION_ONLY =
  /^(opacity|transform|transform-origin|translate|scale|rotate|will-change|--[\w-]+)$/;

const CASES: readonly [string, () => ReactElement, string[]][] = [
  [
    "Says",
    () => (
      <Says textKey="a" pip={<span />}>
        The check reads the note again.
      </Says>
    ),
    ["The check reads the note again."],
  ],
  [
    "CheckLines",
    () => (
      <CheckLines
        lines={[
          { text: "The note names the exit code", ok: true },
          { text: "The claim is corrected", ok: false, evidence: "line 3" },
          { text: "The file exists", ok: false, state: "waiting" },
        ]}
      />
    ),
    [
      "Passes: The note names the exit code",
      "Not yet: The claim is corrected",
      "line 3",
      "Checking: The file exists",
    ],
  ],
  [
    "Hints",
    () => (
      <Hints
        hints={["Look in `src/`.", "Open the newest file."]}
        shown={2}
        onShowNext={() => undefined}
      />
    ),
    ["Hint 1. Look in src/.", "Hint 2. Open the newest file."],
  ],
  [
    "Notice",
    () => <Notice kind="reconnecting" />,
    ["Reconnecting to Claude Code Quest.", "Your place is saved."],
  ],
];

describe("words are whole from the first frame, and only decoration animates", () => {
  test.each(CASES)("%s", (_name, ui, words) => {
    vi.useFakeTimers();
    try {
      const { container } = renderWithMotion(ui());
      // No timer has run: what shows now is the first frame.
      const text = container.textContent;
      for (const w of words) expect(text, w).toContain(w);
      for (const el of container.querySelectorAll<HTMLElement>("*"))
        for (let i = 0; i < el.style.length; i++) {
          const prop = el.style.item(i);
          // A hint rung opens through its height (Hints.tsx, 241): the box
          // grows round words already laid out at their full width.
          if (prop === "height" && el.matches("[data-hint-rung]")) continue;
          expect(prop, el.outerHTML.slice(0, 120)).toMatch(MOTION_ONLY);
        }
      expect(screen.queryByText(/…$/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
