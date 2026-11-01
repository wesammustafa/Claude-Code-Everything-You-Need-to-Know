// The motion tokens as Motion for React reads them: tokens.css declares every
// duration, easing and travel on :root, and reduced motion (the system
// setting or the Settings switch) overrides them there, so a component that
// animates through Motion reads them back from the page rather than writing
// a number of its own.
import type { Transition } from "motion/react";
import { useMemo } from "react";
import { useReducedMotion } from "./page";

/** A cubic Bézier curve, as Motion takes it; "linear" where the token is missing. */
export type Easing = readonly [number, number, number, number] | "linear";

export interface MotionTokens {
  /** Durations and delays, in seconds. */
  press: number;
  fast: number;
  base: number;
  slow: number;
  moment: number;
  stagger: number;
  saysDelay: number;
  /** The screen rise's travel, in CSS pixels. */
  rise: number;
  /** The scale a popping mark starts from. */
  popFrom: number;
  out: Easing;
  inOut: Easing;
}

/** What a missing token gives: no time, no travel, no pop. */
const INSTANT = 0;
const STILL = 1;
const MS_PER_SECOND = 1000;

function seconds(value: string): number {
  const m = /^(-?[\d.]+)(ms|s)$/.exec(value);
  if (m?.[1] === undefined) return INSTANT;
  const n = Number(m[1]);
  return m[2] === "ms" ? n / MS_PER_SECOND : n;
}

function pixels(value: string): number {
  const m = /^(-?[\d.]+)px$/.exec(value);
  return m?.[1] === undefined ? INSTANT : Number(m[1]);
}

function factor(value: string): number {
  return value === "" || Number.isNaN(Number(value)) ? STILL : Number(value);
}

function easing(value: string): Easing {
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(value);
  const points = (m?.[1] ?? "").split(",").map((p) => Number(p.trim()));
  const [x1, y1, x2, y2] = points;
  if (
    points.length !== 4 ||
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined ||
    points.some((p) => Number.isNaN(p))
  )
    return "linear";
  return [x1, y1, x2, y2];
}

/** The motion tokens as they apply to the page now. */
export function motionTokens(): MotionTokens {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    press: seconds(read("--duration-press")),
    fast: seconds(read("--duration-fast")),
    base: seconds(read("--duration-base")),
    slow: seconds(read("--duration-slow")),
    moment: seconds(read("--duration-moment")),
    stagger: seconds(read("--stagger")),
    saysDelay: seconds(read("--says-delay")),
    rise: pixels(read("--rise")),
    popFrom: factor(read("--pop-from")),
    out: easing(read("--ease-out")),
    inOut: easing(read("--ease-in-out")),
  };
}

export type CurrentMotion = MotionTokens & { reduced: boolean };

/** The motion tokens, read again whenever reduced motion turns on or off. */
export function useMotionTokens(): CurrentMotion {
  const reduced = useReducedMotion();
  return useMemo(() => ({ ...motionTokens(), reduced }), [reduced]);
}

/** One Motion entrance: where it starts, where it ends, and how it gets there. */
export interface Entrance {
  initial: Record<string, number | string>;
  animate: Record<string, number | string>;
  transition: Transition;
}

// Under reduced motion every entrance below is an opacity tween at the
// token's duration (at most 120 ms there): never travel, never a spring.
function fade(duration: number, t: CurrentMotion, delay?: number): Entrance {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition:
      delay === undefined
        ? { duration, ease: t.out }
        : { delay, duration, ease: t.out },
  };
}

/**
 * The status words after Pip's Reaction: they wait --says-delay, then rise a
 * third of --rise into place over --duration-base. The delay stays under
 * reduced motion; the words only fade there.
 */
export function saysEntrance(t: CurrentMotion): Entrance {
  if (t.reduced) return fade(t.base, t, t.saysDelay);
  return {
    initial: { opacity: 0, y: t.rise / 3 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: t.saysDelay, duration: t.base, ease: t.out },
  };
}

/** Content that opens below a control (a hint's rung, a reason): its height and opacity, or only opacity. */
export function revealEntrance(t: CurrentMotion): Entrance {
  if (t.reduced) return fade(t.base, t);
  return {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    transition: { duration: t.base, ease: t.out },
  };
}

/**
 * A progress fill sliding in from the left until `ratio` of it shows, or,
 * reduced, fading in at its width. It slides rather than scales, so its
 * rounded end keeps its shape at every width.
 */
export function fillEntrance(t: CurrentMotion, ratio: number): Entrance {
  if (t.reduced) return fade(t.slow, t);
  return {
    initial: { x: "-100%" },
    animate: { x: `${String((ratio - 1) * 100)}%` },
    transition: { duration: t.slow, ease: t.out },
  };
}

/** A mark that pops in: a spring from --pop-from over --duration-moment, or, reduced, a fade. */
export function popEntrance(t: CurrentMotion): Entrance {
  if (t.reduced) return fade(t.moment, t);
  return {
    initial: { scale: t.popFrom },
    animate: { scale: 1 },
    transition: { type: "spring", visualDuration: t.moment },
  };
}
