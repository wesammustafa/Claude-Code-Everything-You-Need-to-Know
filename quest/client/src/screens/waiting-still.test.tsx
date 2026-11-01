// With reduced motion, the waiting state shows its words still (rehoming
// row 478, learn-io:740): the whole waiting line, no spinner, and no
// element of the screen on a looping animation. Pip's Rest under reduced
// motion is the director's (director.test.ts "Rest while reduced motion is on").
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { renderConnected } from "../../test/connected";
import { setMotionSwitch, stubReducedMotion } from "../../test/motion";
import { WAITING_LINE } from "./Welcome";

/** Tailwind's looping animations, and any spinner by name. */
const LOOPS = /\banimate-(spin|ping|pulse|bounce)\b|spinner/;

describe("the waiting state under reduced motion", () => {
  test.each([
    ["the system reducing", true, null],
    ["the switch reducing", false, "reduce"],
  ] as const)(
    "%s: its words show still, with no spinner",
    async (_n, system, choice) => {
      stubReducedMotion(system);
      await setMotionSwitch(choice);
      renderConnected("/", null);
      await waitFor(
        () => {
          expect(
            document.querySelector("[data-connection=waiting]"),
          ).not.toBeNull();
        },
        { timeout: 3000 },
      );
      expect(screen.getByText(WAITING_LINE).textContent).toBe(WAITING_LINE);
      for (const el of document.body.querySelectorAll("*"))
        expect(el.getAttribute("class") ?? "", el.tagName).not.toMatch(LOOPS);
      expect(document.querySelector("[role=progressbar]")).toBeNull();
    },
  );
});
