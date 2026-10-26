// @vitest-environment node
// Reduced motion keeps state changes as fades of at most 120 ms (spec,
// Motion): every change inside a Reaction's Still timeline, which is what
// reduced motion plays, must take 7 frames (117 ms at 60 fps) or fewer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PIP_DIR } from "./record.ts";
import { RIG_RML } from "./turn.ts";

const STILL_SPAN_FRAMES = 7;

/** Each change in a Still timeline that takes longer than STILL_SPAN_FRAMES. */
function longStillSpans(rml: string): string[] {
  const problems: string[] = [];
  for (const anim of rml.matchAll(
    /<LinearAnimation\b[^>]*name="([^"]* Still)"[^>]*>([\s\S]*?)<\/LinearAnimation>/g,
  )) {
    const [, name = "", body = ""] = anim;
    for (const object of body.matchAll(
      /<KeyedObject objectId="([^"]*)">([\s\S]*?)<\/KeyedObject>/g,
    )) {
      const [, id = "", keyed = ""] = object;
      for (const property of keyed.matchAll(
        /<KeyedProperty property="([^"]*)">([\s\S]*?)<\/KeyedProperty>/g,
      )) {
        const [, prop = "", frames = ""] = property;
        const keys = [
          ...frames.matchAll(
            /<KeyFrame\w+ value="([^"]*)" frame="(\d+)"(?: interpolationType="(\w+)")?/g,
          ),
        ].map(([, value, frame, interpolation]) => ({
          value,
          frame: Number(frame),
          // A keyframe with no interpolation type holds.
          moves: (interpolation ?? "hold") !== "hold",
        }));
        for (const [i, from] of keys.entries()) {
          const to = keys[i + 1];
          if (!to || !from.moves || from.value === to.value) continue;
          if (to.frame - from.frame > STILL_SPAN_FRAMES)
            problems.push(
              `${name}: ${id} ${prop} changes over frames ${String(from.frame)}-${String(to.frame)}`,
            );
        }
      }
    }
  }
  return problems;
}

describe("the Still timelines in rig/pip.rml", () => {
  const rml = readFileSync(join(PIP_DIR, RIG_RML), "utf8");

  test("are there, one for each Reaction intensity blends", () => {
    for (const name of ["Success Still", "Retry Still", "Celebration Still"])
      expect(rml).toContain(`name="${name}"`);
  });

  test("change nothing over more than 7 frames", () => {
    expect(longStillSpans(rml)).toEqual([]);
  });

  test("the check catches a long fade, and ignores holds and other timelines", () => {
    const keyed = (frames: string) =>
      `<KeyedObject objectId="0:1"><KeyedProperty property="opacity">${frames}</KeyedProperty></KeyedObject>`;
    const fade =
      '<KeyFrameDouble value="0" frame="40" interpolationType="cubic"/><KeyFrameDouble value="1" frame="54"/>';
    const held =
      '<KeyFrameDouble value="0" frame="0" interpolationType="hold"/><KeyFrameDouble value="1" frame="30"/>';
    expect(
      longStillSpans(
        `<LinearAnimation duration="60" name="Retry Still">${keyed(fade)}${keyed(held)}</LinearAnimation>` +
          `<LinearAnimation duration="60" name="Retry">${keyed(fade)}</LinearAnimation>`,
      ),
    ).toEqual(["Retry Still: 0:1 opacity changes over frames 40-54"]);
  });
});
