import { waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { renderWithMotion, stubReducedMotion } from "../../test/motion";
import { Hints } from "./Hints";
import { Says } from "./Says";

// QuestMotion carries Motion's features from the first render, so an
// entrance always ends shown: never held at its starting state.
for (const reduce of [false, true])
  test(`entrances end shown (${reduce ? "reduced" : "full"} motion)`, async () => {
    stubReducedMotion(reduce);
    renderWithMotion(
      <>
        <Says textKey="a" pip={<span />}>
          Watching
        </Says>
        <Hints hints={["Look in src."]} shown={1} onShowNext={() => {}} />
      </>,
    );
    const words = document.querySelector<HTMLElement>("[data-says-words]");
    const rung = document.querySelector<HTMLElement>("[data-hint-rung]");
    await waitFor(
      () => {
        expect(words?.style.opacity).toBe("1");
        expect(rung?.style.opacity).toBe("1");
        expect(rung?.style.height).not.toBe("0px");
      },
      { timeout: 2000 },
    );
  });
