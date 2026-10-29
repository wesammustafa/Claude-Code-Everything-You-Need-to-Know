import { describe, expect, test } from "vitest";
import { PIP_MODES, PIP_REACTIONS, type PipModel } from "../../pip/contract";
import {
  PIP_SIZES,
  POSTER_FOR,
  POSTER_POSES,
  type PosterPose,
} from "../../pip/posters";
import { posterPose, posterUrl, rigValues, type RigSize } from "./rig";

const model = (fields: Partial<PipModel> = {}): PipModel => ({
  mode: "idle",
  reaction: null,
  gaze: null,
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

  test("every pose has a poster in the build at both sizes", () => {
    for (const pose of Object.keys(POSTER_POSES) as PosterPose[])
      for (const size of Object.keys(PIP_SIZES) as RigSize[])
        expect(posterUrl(pose, size)).toContain(`${pose}-${size}`);
  });
});
