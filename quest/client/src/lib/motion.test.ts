import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  injectTokens,
  setMotionSwitch,
  stubReducedMotion,
} from "../../test/motion";
import {
  fillEntrance,
  motionTokens,
  popEntrance,
  revealEntrance,
  saysEntrance,
  useMotionTokens,
  type CurrentMotion,
} from "./motion";

const REDUCED_MAX = 0.12;

describe("motionTokens", () => {
  test("reads the spec's durations, travel and easing from :root", () => {
    injectTokens();
    expect(motionTokens()).toEqual({
      press: 0.09,
      fast: 0.14,
      base: 0.22,
      slow: 0.36,
      moment: 0.56,
      stagger: 0.04,
      saysDelay: 0.08,
      rise: 8,
      popFrom: 0.6,
      out: [0.2, 0.8, 0.2, 1],
      inOut: [0.65, 0, 0.35, 1],
    });
  });

  test("under the switch's reduce, every duration is at most 120 ms and nothing travels", async () => {
    injectTokens();
    await setMotionSwitch("reduce");
    const t = motionTokens();
    for (const d of [t.fast, t.base, t.slow, t.moment, t.stagger])
      expect(d).toBeLessThanOrEqual(REDUCED_MAX);
    expect(t.rise).toBe(0);
    expect(t.popFrom).toBe(1);
    // A delay, not a movement: the words still follow Pip's Reaction.
    expect(t.saysDelay).toBe(0.08);
  });

  test("a missing token is instant: no time, no travel, no pop", () => {
    expect(motionTokens()).toMatchObject({
      press: 0,
      base: 0,
      slow: 0,
      saysDelay: 0,
      rise: 0,
      popFrom: 1,
      out: "linear",
    });
  });
});

describe("useMotionTokens", () => {
  test("reads the tokens again when reduced motion turns on, from the system or the switch", async () => {
    injectTokens();
    const system = stubReducedMotion(false);
    const { result } = renderHook(() => useMotionTokens());
    expect(result.current).toMatchObject({ reduced: false, base: 0.22 });

    await setMotionSwitch("reduce");
    expect(result.current).toMatchObject({ reduced: true, base: 0.12 });
    await setMotionSwitch(null);
    expect(result.current).toMatchObject({ reduced: false, base: 0.22 });

    stubReducedMotion(true);
    act(() => {
      system.fire();
    });
    expect(result.current).toMatchObject({ reduced: true, base: 0.12 });
  });
});

describe("entrances", () => {
  const full = (): CurrentMotion => {
    injectTokens();
    return { ...motionTokens(), reduced: false };
  };

  test("the status words wait --says-delay, then rise a third of --rise", () => {
    const says = saysEntrance(full());
    expect(says.transition).toMatchObject({ delay: 0.08, duration: 0.22 });
    expect(says.initial).toEqual({ opacity: 0, y: 8 / 3 });
  });

  test("a badge pops on a spring over --duration-moment, with no bounce of its own", () => {
    const pop = popEntrance(full());
    expect(pop.initial).toEqual({ scale: 0.6 });
    expect(pop.transition).toEqual({ type: "spring", visualDuration: 0.56 });
  });

  test("under reduced motion each is an opacity tween of at most 120 ms", async () => {
    injectTokens();
    await setMotionSwitch("reduce");
    const t: CurrentMotion = { ...motionTokens(), reduced: true };
    for (const entrance of [
      saysEntrance(t),
      revealEntrance(t),
      fillEntrance(t, 0.5),
      popEntrance(t),
    ]) {
      expect(Object.keys(entrance.initial)).toEqual(["opacity"]);
      expect(entrance.transition.type).toBeUndefined();
      expect(entrance.transition.duration).toBeLessThanOrEqual(REDUCED_MAX);
    }
  });
});
