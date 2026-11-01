import { afterEach, describe, expect, test, vi } from "vitest";
import { createPipDirector, type DirectorInput } from "./director";
import {
  CONTENT_FADE_PX,
  DEAD_ZONE,
  FALLOFF_REACH,
  NEAR_FADE_PX,
  NEAR_PX,
  followPointer,
  followPull,
  pointerGaze,
  type FrameScheduler,
} from "./pointer";

// A hero Pip, 208 px, centred at (500, 300); half-size 104.
const HERO = { x: 396, y: 196, width: 208, height: 208 };
const CX = 500;
const CY = 300;
const HALF = 104;

describe("where Pip looks for a pointer", () => {
  test("the chosen values: a dead zone about his head, half strength one and a half half-sizes out, 200 px near", () => {
    expect(DEAD_ZONE).toBe(0.6);
    expect(FALLOFF_REACH).toBe(1.5);
    expect(NEAR_PX).toBe(200);
  });

  test("toward the pointer: left, right, above and below", () => {
    expect(pointerGaze(HERO, CX - 400, CY).x).toBeLessThan(-0.5);
    expect(pointerGaze(HERO, CX + 400, CY).x).toBeGreaterThan(0.5);
    expect(pointerGaze(HERO, CX, CY - 400).y).toBeLessThan(-0.5);
    expect(pointerGaze(HERO, CX, CY + 400).y).toBeGreaterThan(0.5);
    expect(pointerGaze(HERO, CX - 400, CY).y).toBe(0);
    expect(pointerGaze(HERO, CX, CY + 400).x).toBe(0);
  });

  test("in the dead zone, on Pip's head, he looks out at the Learner", () => {
    expect(pointerGaze(HERO, CX, CY)).toEqual({ x: 0, y: 0 });
    const edge = HALF * DEAD_ZONE;
    expect(pointerGaze(HERO, CX - edge + 1, CY)).toEqual({ x: 0, y: 0 });
    expect(pointerGaze(HERO, CX, CY + edge - 1)).toEqual({ x: 0, y: 0 });
  });

  test("the gaze leaves the dead zone from 0, with no step", () => {
    const edge = HALF * DEAD_ZONE;
    expect(Math.abs(pointerGaze(HERO, CX - edge - 2, CY).x)).toBeLessThan(0.02);
  });

  test("the falloff: half strength at the reach, and continuous all the way out", () => {
    const reach = HALF * (DEAD_ZONE + FALLOFF_REACH);
    expect(pointerGaze(HERO, CX + reach, CY).x).toBe(0.5);
    // A pointer gliding 4 px a frame moves the gaze a little each frame.
    let last = pointerGaze(HERO, 0, CY).x;
    for (let x = 4; x <= 1000; x += 4) {
      const next = pointerGaze(HERO, x, CY).x;
      expect(Math.abs(next - last)).toBeLessThanOrEqual(0.03);
      expect(next).toBeGreaterThanOrEqual(last);
      last = next;
    }
  });

  test("far corners turn him well toward them without pinning his eyes", () => {
    const corner = pointerGaze(HERO, 0, 0);
    expect(Math.hypot(corner.x, corner.y)).toBeGreaterThan(0.6);
    expect(Math.hypot(corner.x, corner.y)).toBeLessThan(0.85);
    const far = pointerGaze(HERO, CX - 5000, CY);
    expect(far.x).toBeGreaterThan(-1);
    expect(far.x).toBeLessThan(-0.9);
  });

  test("clamped to -1..1, in hundredths", () => {
    for (const [x, y] of [
      [-1e9, 0],
      [1e9, 1e9],
      [CX + 123.456, CY - 77.7],
    ] as const) {
      const at = pointerGaze(HERO, x, y);
      for (const v of [at.x, at.y]) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
        expect(Math.round(v * 100) / 100).toBe(v);
      }
    }
  });

  test("measured in Pip's own size: the small Pip turns as readily", () => {
    const beside = { x: 100, y: 100, width: 76, height: 76 };
    const half = 38;
    const reach = half * (DEAD_ZONE + FALLOFF_REACH);
    expect(pointerGaze(beside, 138 - reach, 138).x).toBe(-0.5);
  });
});

describe("how strongly Pip follows, on the Lesson overview and the step", () => {
  // The step as the app lays it out at 1280 px: Pip at the top left of the
  // column, 20 px in from its edge.
  const pip = { x: 300, y: 113, width: 76, height: 76 };
  const main = { x: 280, y: 56, width: 720, height: 748 };
  const cy = 151;

  test("the chosen values: 200 px near, fading over its last 72 px and the first 32 px off the content", () => {
    expect(NEAR_PX).toBe(200);
    expect(NEAR_FADE_PX).toBe(72);
    expect(CONTENT_FADE_PX).toBe(32);
  });

  test("full near him and off the content: on Pip, at his edge, and in the margin beside him", () => {
    expect(followPull(pip, main, 338, cy)).toBe(1);
    expect(followPull(pip, main, 300, cy)).toBe(1);
    expect(followPull(pip, main, 299, cy)).toBe(1);
    expect(followPull(pip, main, 338, 112)).toBe(1);
    expect(followPull(pip, main, 218, cy)).toBe(1);
    expect(followPull(pip, main, 280 - CONTENT_FADE_PX, cy)).toBe(1);
    expect(followPull(pip, main, 300 - (NEAR_PX - NEAR_FADE_PX), cy)).toBe(1);
  });

  test("none past 200 px of his box, or over the content: the bubble, the gaps, the step card", () => {
    expect(followPull(pip, main, 300 - NEAR_PX, cy)).toBe(0);
    expect(followPull(pip, main, 300 - NEAR_PX - 50, cy)).toBe(0);
    expect(followPull(pip, main, 218, 189 + NEAR_PX + 1)).toBe(0);
    expect(followPull(pip, main, 280, 189 + CONTENT_FADE_PX)).toBe(0);
    expect(followPull(pip, main, 290, 189 + CONTENT_FADE_PX)).toBe(0);
    expect(followPull(pip, main, 376 + CONTENT_FADE_PX, cy)).toBe(0);
    expect(followPull(pip, main, 338, 113 - CONTENT_FADE_PX)).toBe(0);
    expect(followPull(pip, main, 420, cy)).toBe(0);
    expect(followPull(pip, main, 338, 300)).toBe(0);
  });

  test("in the column around him it fades out over the first 32 px from his box", () => {
    const half = followPull(pip, main, 376 + CONTENT_FADE_PX / 2, cy);
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
    expect(followPull(pip, main, 376 + 4, cy)).toBeGreaterThan(0.9);
    expect(followPull(pip, main, 376 + CONTENT_FADE_PX - 4, cy)).toBeLessThan(
      0.1,
    );
  });

  test("at 390 px, where the column fills the window, only on and around him", () => {
    const small = { x: 20, y: 113, width: 76, height: 76 };
    const column = { x: 0, y: 56, width: 390, height: 748 };
    expect(followPull(small, column, 58, cy)).toBe(1);
    expect(followPull(small, column, 2, cy)).toBe(1);
    expect(followPull(small, column, 96 + CONTENT_FADE_PX, cy)).toBe(0);
    expect(followPull(small, column, 58, 189 + CONTENT_FADE_PX)).toBe(0);
    let last = followPull(small, column, 40, cy);
    for (let x = 41; x <= 160; x++) {
      const next = followPull(small, column, x, cy);
      expect(Math.abs(next - last)).toBeLessThanOrEqual(0.06);
      last = next;
    }
  });

  test("with no column, only nearness counts", () => {
    expect(followPull(pip, null, 420, cy)).toBe(1);
    expect(followPull(pip, null, 376 + NEAR_PX + 1, cy)).toBe(0);
  });

  test("in hundredths, and continuous: a pixel's move changes it a little at every edge", () => {
    const level = (x: number) => followPull(pip, main, x, cy);
    const below = (y: number) => followPull(pip, main, 260, y);
    const through = (y: number) => followPull(pip, main, 338, y);
    for (const [at, from, to] of [
      // Toward Pip across his reach, in the margin.
      [level, 300 - NEAR_PX - 20, 300 - NEAR_PX + NEAR_FADE_PX + 20],
      // From on Pip, across his left edge and the column's, into the margin.
      [level, 320, 280 - CONTENT_FADE_PX - 20],
      // From on Pip, across his right edge, onto the content.
      [level, 360, 376 + CONTENT_FADE_PX + 20],
      // From on Pip, up across his top edge, onto the content.
      [through, 140, 113 - CONTENT_FADE_PX - 20],
      // From on Pip, down across his bottom edge, onto the content.
      [through, 170, 189 + CONTENT_FADE_PX + 20],
      // Up into his reach, below him beside the column.
      [below, 189 + NEAR_PX + 10, 189 + NEAR_PX - NEAR_FADE_PX - 10],
    ] as const) {
      const step = from < to ? 1 : -1;
      let last = at(from);
      for (let v = from + step; v !== to; v += step) {
        const next = at(v);
        expect(Math.round(next * 100) / 100).toBe(next);
        expect(Math.abs(next - last)).toBeLessThanOrEqual(0.06);
        last = next;
      }
    }
  });

  /**
   * The gaze the director gives on the step for each point the mouse moves
   * through, one move a frame, as the page sends it.
   */
  function gazesAlong(points: readonly (readonly [number, number])[]) {
    let t = 0;
    const director = createPipDirector(() => t, { screen: "step" });
    return points.map(([x, y]) => {
      t += 16;
      const { gaze } = director.send({
        type: "pointer",
        at: pointerGaze(pip, x, y),
        pull: followPull(pip, main, x, y),
      });
      if (gaze === null) throw new Error("no gaze");
      return gaze;
    });
  }

  const biggestStep = (gazes: readonly { x: number; y: number }[]) =>
    Math.max(
      ...gazes
        .slice(1)
        .map((g, i) =>
          Math.hypot(g.x - (gazes[i]?.x ?? g.x), g.y - (gazes[i]?.y ?? g.y)),
        ),
    );

  test("a hand wobbling 5 px across the edge of his reach barely moves him", () => {
    const edge = pip.x - NEAR_PX;
    const gazes = gazesAlong(
      Array.from(
        { length: 60 },
        (_, i) => [edge + 5 * Math.sin(i * 1.3), 120 + i] as const,
      ),
    );
    expect(biggestStep(gazes)).toBeLessThanOrEqual(0.1);
    for (const g of gazes) expect(g.x).toBeGreaterThan(0.3);
  });

  test("a hand resting along the column's edge, wobbling 6 px across it, keeps him at rest", () => {
    // Below his own fade, which reaches past the column's edge beside him.
    const top = 189 + CONTENT_FADE_PX;
    const gazes = gazesAlong(
      Array.from(
        { length: 60 },
        (_, i) => [main.x + 6 * Math.sin(i * 1.7), top + 4 * i] as const,
      ),
    );
    expect(biggestStep(gazes)).toBeLessThanOrEqual(0.1);
    for (const g of gazes) {
      expect(Math.abs(g.x - 0.4)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(g.y)).toBeLessThanOrEqual(0.1);
    }
  });

  test("a hand wobbling 3 px across any edge of his own box barely moves him", () => {
    const wobble = (edge: (d: number) => readonly [number, number]) =>
      gazesAlong(
        Array.from({ length: 40 }, (_, i) => edge(3 * Math.sin(i * 1.7))),
      );
    for (const edge of [
      (d: number) => [300 + d, cy] as const,
      (d: number) => [376 + d, cy] as const,
      (d: number) => [338, 113 + d] as const,
      (d: number) => [338, 189 + d] as const,
      (d: number) => [300 + d, 113 + d] as const,
    ]) {
      expect(biggestStep(wobble(edge))).toBeLessThanOrEqual(0.1);
    }
  });

  test("beside him, a hand wobbling across the column's edge barely moves him", () => {
    const gazes = gazesAlong(
      Array.from(
        { length: 40 },
        (_, i) => [main.x + 6 * Math.sin(i * 1.7), 113 + 2 * i] as const,
      ),
    );
    expect(biggestStep(gazes)).toBeLessThanOrEqual(0.1);
  });

  test("passing from the margin across Pip and out over the content, he turns without a step", () => {
    const gazes = gazesAlong(
      Array.from({ length: 80 }, (_, i) => [200 + 3 * i, cy] as const),
    );
    expect(biggestStep(gazes)).toBeLessThanOrEqual(0.1);
    expect(gazes.at(-1)).toEqual({ x: 0.4, y: 0 });
  });

  test("coming near from far away, he turns from his resting gaze without a step", () => {
    const gazes = gazesAlong(
      Array.from({ length: 74 }, (_, i) => [20 + 3 * i, cy] as const),
    );
    expect(gazes[0]).toEqual({ x: 0.4, y: 0 });
    expect(gazes.at(-1)?.x).toBeLessThan(-0.4);
    expect(biggestStep(gazes)).toBeLessThanOrEqual(0.1);
  });
});

describe("following the mouse on the page", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  // A page with a Pip at HERO, a frame the test runs by hand, and what the
  // director was sent.
  function setup(still = false) {
    document.body.innerHTML = `<main><span data-pip></span><p id="text">Text</p></main>`;
    const el = document.querySelector("[data-pip]");
    if (el === null) throw new Error("no Pip");
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect(HERO),
    );
    // The column: Pip at its left edge, the content to his right.
    const main = document.querySelector("main");
    if (main === null) throw new Error("no main");
    vi.spyOn(main, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: HERO.x, y: 0, width: 800, height: 2000 }),
    );
    let queued: (() => void) | null = null;
    let requested = 0;
    const frame: FrameScheduler = {
      request: (run) => {
        requested++;
        queued = run;
        return requested;
      },
      cancel: () => {
        queued = null;
      },
    };
    const sent: DirectorInput[] = [];
    const stop = followPointer(window, {
      pip: () => document.querySelector("[data-pip]"),
      still: () => still,
      send: (input) => sent.push(input),
      frame,
    });
    const runFrame = () => {
      const run = queued;
      queued = null;
      run?.();
    };
    const move = (x: number, y: number, pointerType = "mouse") => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: x,
          clientY: y,
          pointerType,
        }),
      );
    };
    return {
      sent,
      move,
      runFrame,
      stop,
      requested: () => requested,
      queued: () => queued !== null,
    };
  }

  test("many moves in one frame send the latest once, when the frame comes", () => {
    const { sent, move, runFrame, requested } = setup();
    move(100, CY);
    move(200, CY);
    move(CX + 400, CY);
    expect(requested()).toBe(1);
    expect(sent).toEqual([]);
    runFrame();
    expect(sent).toEqual([
      { type: "pointer", at: pointerGaze(HERO, CX + 400, CY), pull: 0 },
    ]);
  });

  test("no frame is asked for while the mouse is still", () => {
    const { move, runFrame, requested, queued } = setup();
    expect(requested()).toBe(0);
    move(100, CY);
    runFrame();
    expect(queued()).toBe(false);
    expect(requested()).toBe(1);
    move(120, CY);
    runFrame();
    expect(requested()).toBe(2);
    expect(queued()).toBe(false);
  });

  test("sends the pull: near Pip and off the content, over the content, far away", () => {
    const { sent, move, runFrame } = setup();
    for (const [x, y] of [
      [CX - 150, CY],
      [CX + 150, CY],
      [CX - 400, CY],
    ] as const) {
      move(x, y);
      runFrame();
    }
    expect(sent.map((input) => input.type === "pointer" && input.pull)).toEqual(
      [1, 0, 0],
    );
  });

  test.each(["touch", "pen"])(
    "%s is never followed, and lets go of the mouse it took over from",
    (pointerType) => {
      const { sent, move, runFrame, requested } = setup();
      move(100, CY, pointerType);
      expect(requested()).toBe(0);
      expect(sent).toEqual([]);
      move(100, CY);
      runFrame();
      move(300, CY, pointerType);
      runFrame();
      expect(sent.map((input) => input.type)).toEqual([
        "pointer",
        "pointerGone",
      ]);
    },
  );

  test("leaving the window lets go at once, and drops a frame not yet drawn", () => {
    const { sent, move, runFrame } = setup();
    move(100, CY);
    runFrame();
    move(120, CY);
    window.dispatchEvent(
      new PointerEvent("pointerout", {
        pointerType: "mouse",
        relatedTarget: null,
      }),
    );
    runFrame();
    expect(sent.map((input) => input.type)).toEqual(["pointer", "pointerGone"]);
  });

  test("a scroll lets go at once, and drops a frame not yet drawn", () => {
    const { sent, move, runFrame } = setup();
    move(100, CY);
    runFrame();
    move(120, CY);
    document.querySelector("main")?.dispatchEvent(new Event("scroll"));
    runFrame();
    expect(sent.map((input) => input.type)).toEqual(["pointer", "pointerGone"]);
  });

  test("a scroll with nothing followed sends nothing", () => {
    const { sent } = setup();
    window.dispatchEvent(new Event("scroll"));
    expect(sent).toEqual([]);
  });

  test("moving between elements is not leaving", () => {
    const { sent, move, runFrame } = setup();
    move(100, CY);
    runFrame();
    window.dispatchEvent(
      new PointerEvent("pointerout", {
        pointerType: "mouse",
        relatedTarget: document.body,
      }),
    );
    expect(sent.map((input) => input.type)).toEqual(["pointer"]);
  });

  test("while Pip holds still (reduced motion) nothing runs", () => {
    const { sent, move, requested } = setup(true);
    move(100, CY);
    expect(requested()).toBe(0);
    expect(sent).toEqual([]);
  });

  test("with no Pip drawn, nothing is sent", () => {
    const { sent, move, runFrame } = setup();
    document.body.replaceChildren();
    move(100, CY);
    runFrame();
    expect(sent).toEqual([]);
  });

  test("stopped, it hears nothing more", () => {
    const { sent, move, stop, requested } = setup();
    move(100, CY);
    stop();
    move(120, CY);
    window.dispatchEvent(new Event("scroll"));
    expect(requested()).toBe(1);
    expect(sent).toEqual([]);
  });

  test("stopped with a frame not yet drawn, the frame is dropped and sends nothing", () => {
    const { sent, move, runFrame, stop, queued } = setup();
    move(100, CY);
    expect(queued()).toBe(true);
    stop();
    expect(queued()).toBe(false);
    runFrame();
    expect(sent).toEqual([]);
  });
});
