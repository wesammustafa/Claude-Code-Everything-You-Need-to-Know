// Pip follows the pointer: the pure mapping from where the mouse is to where
// Pip looks, and the page's listener that hands it to the director at most
// once per animation frame, and only while the mouse moves. The director
// decides whether Pip follows it (the screen, a Reaction playing, the 2 s
// release); the rig's gaze ease smooths every change.
import type { DirectorInput, GazePoint } from "./director";

/**
 * On the Lesson overview and the step, Pip follows only while the pointer is
 * within this many px of his box (the ticket's "about 200 px").
 */
export const NEAR_PX = 200;
/**
 * Over the last this many px inside NEAR_PX, Pip's pull toward the pointer
 * fades to nothing, so coming near him or leaving starts from his resting
 * gaze rather than a swing: a hand wobbling at the edge barely moves him.
 */
export const NEAR_FADE_PX = 72;
/**
 * Off the content, the pull grows over this many px from its edge, so a
 * pointer resting along the column's edge, a hand beside the text being
 * read, never flips his gaze back and forth. Pip and a ring this wide
 * around him are off the content too, so the pull grows across the ring
 * toward his box and a hand on his own edge never flips it either.
 */
export const CONTENT_FADE_PX = 32;
/**
 * The dead zone, as a share of Pip's half-size: a pointer this close to his
 * centre (about his head) is on him, so he looks out at the Learner rather
 * than at a point inside himself.
 */
export const DEAD_ZONE = 0.6;
/**
 * The falloff's reach, in Pip's half-sizes: past the dead zone the gaze grows
 * as distance / (distance + reach), so it starts from 0 with no step, reaches
 * half at this distance, and only nears 1 far away: a far corner turns Pip
 * well toward it without pinning his eyes at the edge. Measured in his own
 * size, so the small Pip beside the step turns as readily within his 200 px
 * as the large one does across Welcome.
 */
export const FALLOFF_REACH = 1.5;

/** A box on the page, in CSS px: Pip's, from getBoundingClientRect. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
// Hundredths: finer than the eye can tell once the rig eases, and a mouse
// creeping a pixel at a time then changes nothing for the director to draw.
const hundredths = (v: number) => Math.round(v * 100) / 100 || 0;

/**
 * Where Pip looks for a pointer at (x, y): the direction from his centre,
 * -1..1 on each axis (+x right, +y down), clamped, 0 in the dead zone, with
 * a soft falloff beyond it.
 */
export function pointerGaze(pip: Box, x: number, y: number): GazePoint {
  const half = Math.min(pip.width, pip.height) / 2;
  const dx = x - (pip.x + pip.width / 2);
  const dy = y - (pip.y + pip.height / 2);
  const distance = Math.hypot(dx, dy);
  const beyond = distance - half * DEAD_ZONE;
  if (beyond <= 0) return { x: 0, y: 0 };
  const strength = beyond / (beyond + half * FALLOFF_REACH);
  return {
    x: hundredths(clamp((dx / distance) * strength)),
    y: hundredths(clamp((dy / distance) * strength)),
  };
}

/** How far (x, y) is from `box`: 0 on or inside it. */
const distanceTo = (box: Box, x: number, y: number) =>
  Math.hypot(
    Math.max(box.x - x, 0, x - (box.x + box.width)),
    Math.max(box.y - y, 0, y - (box.y + box.height)),
  );

/** `box` grown by `by` px on every side. */
const grown = (box: Box, by: number): Box => ({
  x: box.x - by,
  y: box.y - by,
  width: box.width + 2 * by,
  height: box.height + 2 * by,
});

/**
 * The parts of `box` outside `hole`, as up to four boxes: the strips above
 * and below the hole, and those left and right of it between them.
 */
function around(box: Box, hole: Box): Box[] {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const above = Math.min(bottom, hole.y);
  const below = Math.max(box.y, hole.y + hole.height);
  const top = Math.max(box.y, hole.y);
  const low = Math.min(bottom, hole.y + hole.height);
  const left = Math.min(right, hole.x);
  const beyond = Math.max(box.x, hole.x + hole.width);
  return [
    { x: box.x, y: box.y, width: box.width, height: above - box.y },
    { x: box.x, y: below, width: box.width, height: bottom - below },
    { x: box.x, y: top, width: left - box.x, height: low - top },
    { x: beyond, y: top, width: right - beyond, height: low - top },
  ].filter((part) => part.width > 0 && part.height > 0);
}

/** 0 at or below 0, 1 at or above 1, easing in and out between. */
const smoothstep = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};

/**
 * How strongly Pip follows a pointer at (x, y) on the Lesson overview and
 * the step, 0..1 in hundredths: 1 near him and off the content, 0 past
 * NEAR_PX or over the content (anywhere in the screen's `main` but Pip and
 * the CONTENT_FADE_PX ring around him: the gaps between its boxes too, so a
 * pointer crossing from the bubble to the step card never sets him off). It
 * fades over the last NEAR_FADE_PX of his reach and the first
 * CONTENT_FADE_PX off the content, the column's edge and the ring alike, so
 * the gaze never steps at any edge, his own included.
 */
export function followPull(
  pip: Box,
  main: Box | null,
  x: number,
  y: number,
): number {
  const near = smoothstep((NEAR_PX - distanceTo(pip, x, y)) / NEAR_FADE_PX);
  const content =
    main === null ? [] : around(main, grown(pip, CONTENT_FADE_PX));
  // Infinity with no content at all: nothing to keep him from following.
  const offContent = Math.min(...content.map((part) => distanceTo(part, x, y)));
  const clear = smoothstep(offContent / CONTENT_FADE_PX);
  return hundredths(near * clear);
}

export interface FrameScheduler {
  request: (run: () => void) => number;
  cancel: (handle: number) => void;
}

export interface FollowOptions {
  /** The Pip on the page, or null when none is drawn. */
  pip: () => Element | null;
  /** Pip holds still (reduced motion): the pointer is not even looked at. */
  still: () => boolean;
  send: (input: DirectorInput) => void;
  /** The animation frame; the page's own unless a test brings one. */
  frame?: FrameScheduler;
}

/**
 * Follows the mouse over `win` and tells the director where Pip should look:
 * at most once per animation frame, from the latest move, and no frame is
 * asked for while the mouse is still. Touch and pen are never followed, and
 * a mouse leaving the window releases Pip at once. Returns the cleanup.
 */
export function followPointer(win: Window, options: FollowOptions): () => void {
  const { pip, still, send } = options;
  const frame: FrameScheduler = options.frame ?? {
    request: (run) => win.requestAnimationFrame(run),
    cancel: (handle) => {
      win.cancelAnimationFrame(handle);
    },
  };
  let latest: PointerEvent | null = null;
  let pending: number | null = null;
  // Whether the director has a pointer to let go of.
  let told = false;

  const draw = () => {
    pending = null;
    const event = latest;
    latest = null;
    const el = pip();
    if (event === null || el === null) return;
    const box = el.getBoundingClientRect();
    const main = el.closest("main")?.getBoundingClientRect() ?? null;
    const { clientX: x, clientY: y } = event;
    told = true;
    send({
      type: "pointer",
      at: pointerGaze(box, x, y),
      pull: followPull(box, main, x, y),
    });
  };
  const release = () => {
    if (pending !== null) frame.cancel(pending);
    pending = null;
    latest = null;
    if (!told) return;
    told = false;
    send({ type: "pointerGone" });
  };
  const moved = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") {
      release();
      return;
    }
    if (still()) return;
    latest = event;
    pending ??= frame.request(draw);
  };
  // Leaving the document, the pointer goes out to nothing.
  const out = (event: PointerEvent) => {
    if (event.relatedTarget === null) release();
  };
  // A scroll slides Pip and the content under a mouse that fires no move, so
  // the gaze and pull worked out before it no longer hold: let go, and the
  // next move works them out afresh. Captured, to hear scrolling elements too.
  const scrolled = () => {
    release();
  };

  const passive = { passive: true } as const;
  const captured = { passive: true, capture: true } as const;
  win.addEventListener("pointermove", moved, passive);
  win.addEventListener("pointerout", out, passive);
  win.addEventListener("scroll", scrolled, captured);
  return () => {
    win.removeEventListener("pointermove", moved);
    win.removeEventListener("pointerout", out);
    win.removeEventListener("scroll", scrolled, captured);
    if (pending !== null) frame.cancel(pending);
    pending = null;
  };
}
