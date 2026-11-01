import { describe, expect, test } from "vitest";
import { PIP_MODES, PIP_REACTIONS, type PipModel } from "../../pip/contract";
import {
  PIP_SIZES,
  POSTER_FOR,
  POSTER_POSES,
  REST_TOWARD_CONTENT,
  SIZE_TURNS,
  type PosterPose,
} from "../../pip/posters";
import { restingGaze, type PipScreen } from "./director";
import {
  posterGazeX,
  posterPose,
  posterTurnFor,
  posterUrl,
  rigValues,
  type RigSize,
} from "./rig";

const model = (fields: Partial<PipModel> = {}): PipModel => ({
  mode: "idle",
  reaction: null,
  gaze: null,
  restingGaze: { x: 0, y: 0 },
  reducedMotion: false,
  size: "beside",
  ...fields,
});

describe("the view model's values", () => {
  test.each(PIP_MODES)("carry the mode %s by name", (mode) => {
    expect(rigValues(model({ mode })).mode).toBe(mode);
  });

  test("a null gaze is the centre, so Pip holds still under reduced motion", () => {
    expect(rigValues(model({ gaze: null, reducedMotion: true }))).toEqual({
      mode: "idle",
      gazeX: 0,
      gazeY: 0,
      reducedMotion: true,
    });
  });

  test("a gaze passes through, clamped to -1..1", () => {
    expect(rigValues(model({ gaze: { x: 0.5, y: -0.25 } }))).toMatchObject({
      gazeX: 0.5,
      gazeY: -0.25,
    });
    expect(rigValues(model({ gaze: { x: 3, y: -2 } }))).toMatchObject({
      gazeX: 1,
      gazeY: -1,
    });
  });
});

describe("the poster", () => {
  test.each(PIP_MODES)("for the mode %s is the mode's", (mode) => {
    expect(posterPose(model({ mode }), false)).toBe(POSTER_FOR[mode]);
  });

  test.each(PIP_REACTIONS)(
    "for a %s Reaction is its own while its poster holds, then the mode's",
    (kind) => {
      const reacting = model({
        mode: "thinking",
        reaction: { id: "e.1", kind, intensity: 1 },
      });
      expect(posterPose(reacting, true)).toBe(POSTER_FOR[kind]);
      expect(posterPose(reacting, false)).toBe(POSTER_FOR.thinking);
    },
  );

  test("every pose has a poster in the build at each size and turn", () => {
    for (const pose of Object.keys(POSTER_POSES) as PosterPose[])
      for (const size of Object.keys(PIP_SIZES) as RigSize[])
        for (const turn of SIZE_TURNS[size])
          expect(posterUrl(pose, size, turn)).toContain(
            `${pose}-${size}-${turn}`,
          );
  });

  test("shows exactly the resting gaze of every screen, beside and at the hero size", () => {
    const screens = [
      "welcome",
      "resume",
      "map",
      "intro",
      "step",
      "levelup",
      "complete",
      "next",
      "levelComplete",
      "courseComplete",
      "progress",
      "other",
    ] as const satisfies readonly PipScreen[];
    for (const screen of screens) {
      const rest = restingGaze(screen);
      for (const size of Object.keys(PIP_SIZES) as RigSize[]) {
        if (size === "hero" && rest.x !== 0) continue;
        const turn = posterTurnFor(
          model({ gaze: rest, restingGaze: rest, size }),
          size,
        );
        expect(posterGazeX(turn), `${screen} at ${size}`).toBe(rest.x);
      }
    }
  });

  test("beside, turns toward the content near its resting gaze and faces the Learner otherwise", () => {
    const at = (x: number) =>
      posterTurnFor(model({ restingGaze: { x, y: 0 } }), "beside");
    expect(at(REST_TOWARD_CONTENT)).toBe("content");
    expect(at(0.94)).toBe("content");
    expect(at(0)).toBe("front");
    expect(at(-0.6)).toBe("front");
    expect(
      posterTurnFor(model({ restingGaze: { x: 0.4, y: 0 } }), "hero"),
    ).toBe("front");
  });

  test("keeps its turn wherever the gaze goes for a moment: the pointer, a glance or a look is the rig's alone", () => {
    const beside = { x: REST_TOWARD_CONTENT, y: 0 };
    for (const x of [-1, -0.6, 0, 0.19, 0.21, 1]) {
      expect(
        posterTurnFor(
          model({ gaze: { x, y: 0.3 }, restingGaze: beside }),
          "beside",
        ),
        `gaze ${String(x)} beside the content`,
      ).toBe("content");
      expect(
        posterTurnFor(
          model({ gaze: { x, y: 0.3 }, restingGaze: { x: 0, y: 0 } }),
          "beside",
        ),
        `gaze ${String(x)} centred`,
      ).toBe("front");
    }
  });
});
