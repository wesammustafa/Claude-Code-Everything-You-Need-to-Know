// @vitest-environment node
// The head turn is derived, never hand-edited: the committed rig must hold
// exactly what turn.ts writes, so a change to the box model, or a hand edit
// to the Turn or to a part it keys, fails here until `npm run pip:turn` runs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PIP_DIR } from "./record.ts";
import {
  PITCH_LIMIT_DEGREES,
  RIG_RML,
  TURN_BEGIN,
  TURN_END,
  TURN_LIMIT_DEGREES,
  headFaces,
  pitchValues,
  projectPoint,
  turnValues,
  withTurn,
} from "./turn.ts";

const rml = readFileSync(join(PIP_DIR, RIG_RML), "utf8");

describe("the head turn in rig/pip.rml", () => {
  test("is exactly what turn.ts writes", () => {
    expect(
      withTurn(rml) === rml,
      "run npm run pip:turn, then npm run pip:build",
    ).toBe(true);
  });

  test("names every object each timeline keys", () => {
    expect(rml.match(/<KeyedObject objectId="[^"]*">\s*$/gm) ?? []).toEqual([]);
  });

  test("catches a hand edit to a part's resting value or to a Turn key", () => {
    const art = rml.replace(
      /(<Node x=")[^"]*(" y="\d+" name="Face" id="0:600">)/,
      "$1401$2",
    );
    expect(art).not.toBe(rml);
    expect(withTurn(art)).toBe(rml);
    const at = rml.indexOf(TURN_BEGIN);
    const key =
      rml.slice(0, at) +
      rml
        .slice(at)
        .replace(/(<KeyFrameDouble value=")[^"]*(" frame=")/, "$1999$2");
    expect(key).not.toBe(rml);
    expect(withTurn(key)).toBe(rml);
  });

  test("keys every part the same at both ends of the turn, mirrored about the front view", () => {
    const left = turnValues(-1);
    const right = turnValues(1);
    expect([...left.keys()]).toEqual([...right.keys()]);
    // The face slides as far each way.
    const x = (values: typeof left) => Number(values.get("0:600")?.get("x"));
    expect(x(left) - 400).toBeCloseTo(400 - x(right), 6);
  });

  // Each ear by its parts' ids: front face, outer face, outline.
  const EARS = {
    left: { front: 610, outer: 612, outline: 740 },
    right: { front: 614, outer: 616, outline: 742 },
  } as const;
  const SAMPLE_GAZES = Array.from({ length: 9 }, (_, i) => -1 + i / 4);
  const value = (
    values: ReturnType<typeof turnValues>,
    id: number,
    p: string,
  ) => Number(values.get(`0:${String(id)}`)?.get(p));
  // A part's span on screen, in art x, from its x and its rectangle's width.
  const span = (values: ReturnType<typeof turnValues>, id: number) => {
    const x = value(values, id, "x");
    const half = value(values, id + 1, "width") / 2;
    return [x - half, x + half] as const;
  };

  test("draws nothing of a far ear the head hides: no face and no outline", () => {
    for (const gaze of SAMPLE_GAZES) {
      const values = turnValues(gaze);
      for (const ear of Object.values(EARS)) {
        const width = (id: number) => value(values, id + 1, "width");
        if (width(ear.front) === 0 && width(ear.outer) === 0)
          expect(width(ear.outline), `gaze ${String(gaze)}`).toBe(0);
      }
    }
  });

  test("turns each ear as the mirror of the other", () => {
    for (const gaze of SAMPLE_GAZES) {
      const left = turnValues(gaze);
      const right = turnValues(-gaze);
      for (const part of ["front", "outer", "outline"] as const) {
        const at = `${part} at gaze ${String(gaze)}`;
        expect(value(left, EARS.left[part], "x"), at).toBeCloseTo(
          800 - value(right, EARS.right[part], "x"),
          6,
        );
        expect(value(left, EARS.left[part] + 1, "width"), at).toBeCloseTo(
          value(right, EARS.right[part] + 1, "width"),
          6,
        );
      }
    }
  });

  const HEAD_POINTS = headFaces()
    .filter((face) => face.kind === "wall")
    .flatMap((face) => face.points);
  const headEdge = (gaze: number, sign: number) => {
    const phi = (gaze * TURN_LIMIT_DEGREES * Math.PI) / 180;
    const xs = HEAD_POINTS.map((point) => 400 - projectPoint(point, phi, 0).x);
    return sign > 0 ? Math.min(...xs) : Math.max(...xs);
  };

  test("keeps the far ear outside the head between the samples too, as the keys interpolate", () => {
    // Ear Left is the far ear for a positive gaze, and its right edge meets
    // the silhouette's left edge; Ear Right mirrors it.
    const cases = [
      { ear: EARS.left, sign: 1 },
      { ear: EARS.right, sign: -1 },
    ] as const;
    for (const { ear, sign } of cases) {
      for (let i = 6; i < 8; i++) {
        const gazeA = (sign * (i - 4)) / 4;
        const gazeB = (sign * (i - 3)) / 4;
        const a = turnValues(gazeA);
        const b = turnValues(gazeB);
        for (let step = 0; step <= 10; step++) {
          const t = step / 10;
          const mix = (u: number, v: number) => u + (v - u) * t;
          const head = mix(headEdge(gazeA, sign), headEdge(gazeB, sign));
          for (const part of Object.values(ear)) {
            const [from, to] = span(a, part);
            const [from2, to2] = span(b, part);
            const at = `${String(part)} between frames ${String(i)} and ${String(i + 1)}, t ${String(t)}`;
            if (sign > 0)
              expect(mix(to, to2), at).toBeLessThanOrEqual(head + 1e-3);
            else
              expect(mix(from, from2), at).toBeGreaterThanOrEqual(head - 1e-3);
          }
        }
      }
    }
  });

  test("pitch moves the whole face down and up, revealing the top and underside in turn", () => {
    const down = pitchValues(1);
    const up = pitchValues(-1);
    expect(value(down, 600, "y")).toBeGreaterThan(value(up, 600, "y"));
    expect(value(down, 1020, "opacity")).toBe(1);
    expect(value(down, 1021, "opacity")).toBe(0);
    expect(value(up, 1020, "opacity")).toBe(0);
    expect(value(up, 1021, "opacity")).toBe(1);
  });

  test("turn and pitch compose the same projection at every diagonal", () => {
    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 0, 1]) {
        const phi = (x * TURN_LIMIT_DEGREES * Math.PI) / 180;
        const theta = (y * PITCH_LIMIT_DEGREES * Math.PI) / 180;
        for (const point of HEAD_POINTS) {
          const diagonal = projectPoint(point, phi, theta);
          expect(diagonal.x).toBeCloseTo(projectPoint(point, phi, 0).x, 12);
          expect(diagonal.y).toBeCloseTo(projectPoint(point, 0, theta).y, 12);
        }
      }
    }
  });

  test("writes a well-formed block between its markers", () => {
    expect(rml.split(TURN_BEGIN)).toHaveLength(2);
    expect(rml.split(TURN_END)).toHaveLength(2);
  });

  test("refuses a rig with no Turn markers", () => {
    expect(() => withTurn("<Rive/>")).toThrow(/no Turn markers/);
  });
});
