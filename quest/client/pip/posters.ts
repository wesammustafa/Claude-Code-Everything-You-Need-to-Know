// Pip's static posters: frames the pinned Rive CLI renders from the rig itself,
// so the fallback art never drifts from Pip. They show while the runtime loads
// and stay wherever it fails. `npm run pip:build` renders them from these
// poses; the renderer picks one per mode and Reaction.
import type { PipMode, PipProperty, PipReactionKind } from "./contract.ts";

/** Pip's on-screen sizes in CSS pixels. The icon size is a static SVG, never the rig. */
export const PIP_SIZES = { beside: 76, hero: 208 } as const;
export type PipSize = keyof typeof PIP_SIZES;

/** Posters are rendered at twice the on-screen size, for high-density screens. */
export const POSTER_SCALE = 2;

/**
 * Pip's resting gaze beside the content: turned toward it, to his right
 * (owner, 2026-10-26: "about 0.4"). The director rests him there beside the
 * content; centred, he rests facing the Learner.
 */
export const REST_TOWARD_CONTENT = 0.4;

/**
 * The turns a poster is drawn at, by the gazeX each shows: facing the
 * Learner, or turned toward the content beside him.
 */
export const POSTER_TURNS = {
  front: 0,
  content: REST_TOWARD_CONTENT,
} as const;
export type PosterTurn = keyof typeof POSTER_TURNS;

/**
 * The turns each size is drawn at. Beside the step Pip rests turned toward
 * the content, and on a screen where he sits centred (an address with no
 * screen) he rests facing the Learner, so the beside posters come in both
 * turns; at the hero size he always rests facing the Learner. Whatever his
 * resting gaze, his poster shows it, so the poster hands over to the rig in
 * the same pose, and where Rive fails he still faces the right way.
 */
export const SIZE_TURNS = {
  beside: ["content", "front"],
  hero: ["front"],
} as const satisfies Record<PipSize, readonly PosterTurn[]>;

/** The turn a poster at `size` shows for a gazeX: the size's turn nearest it. */
export function posterTurn(size: PipSize, gazeX: number): PosterTurn {
  const turns: readonly PosterTurn[] = SIZE_TURNS[size];
  let best: PosterTurn = turns[0] ?? "front";
  for (const turn of turns)
    if (
      Math.abs(POSTER_TURNS[turn] - gazeX) <
      Math.abs(POSTER_TURNS[best] - gazeX)
    )
      best = turn;
  return best;
}

export interface Pose {
  /** View model values set before the scene runs; a trigger fires. */
  data: Partial<Record<PipProperty, string>>;
  /** How far the scene runs before the capture, as the CLI's --advance takes it. */
  advance: string;
}

/**
 * The poses: idle (past the gaze's 220 ms ease, before Idle's first glance at
 * 2.5 s), thinking, a happy frame near the top of a full Success, and a
 * reassuring frame in Retry's nod. Every pose runs past the gaze's ease.
 */
export const POSTER_POSES = {
  idle: { data: {}, advance: "300ms" },
  thinking: { data: { mode: "thinking" }, advance: "1s" },
  happy: { data: { intensity: "1", success: "1" }, advance: "450ms" },
  reassuring: { data: { intensity: "1", retry: "1" }, advance: "560ms" },
} as const satisfies Record<string, Pose>;
export type PosterPose = keyof typeof POSTER_POSES;

/** The poster each mode and Reaction shows. */
export const POSTER_FOR = {
  idle: "idle",
  thinking: "thinking",
  rest: "idle",
  greeting: "idle",
  curious: "idle",
  explaining: "idle",
  success: "happy",
  celebration: "happy",
  retry: "reassuring",
} as const satisfies Record<PipMode | PipReactionKind, PosterPose>;

/** A poster's path, relative to quest/client/pip/. */
export function posterFile(
  pose: PosterPose,
  size: PipSize,
  turn: PosterTurn,
): string {
  return `posters/${pose}-${size}-${turn}.png`;
}

/**
 * Everything besides the rig that the posters are rendered from: their scale,
 * the sizes, the poses and the turns. pip:build records it, so CI sees a
 * change here that the committed posters do not show yet.
 */
export interface PosterSpec {
  scale: number;
  sizes: Readonly<Record<PipSize, number>>;
  poses: Readonly<Record<PosterPose, Pose>>;
  turns: Readonly<Record<PosterTurn, number>>;
  sizeTurns: Readonly<Record<PipSize, readonly PosterTurn[]>>;
}

export function posterSpec(): PosterSpec {
  return {
    scale: POSTER_SCALE,
    sizes: PIP_SIZES,
    poses: POSTER_POSES,
    turns: POSTER_TURNS,
    sizeTurns: SIZE_TURNS,
  };
}

/** Every poster the build writes: its pose, the view model values it is rendered with and its size in device pixels. */
export function allPosters(): {
  file: string;
  pose: PosterPose;
  turn: PosterTurn;
  data: Pose["data"];
  px: number;
}[] {
  return (Object.keys(POSTER_POSES) as PosterPose[]).flatMap((pose) =>
    (Object.keys(PIP_SIZES) as PipSize[]).flatMap((size) =>
      SIZE_TURNS[size].map((turn) => ({
        file: posterFile(pose, size, turn),
        pose,
        turn,
        data: {
          ...POSTER_POSES[pose].data,
          ...(POSTER_TURNS[turn] === 0
            ? {}
            : { gazeX: String(POSTER_TURNS[turn]) }),
        },
        px: PIP_SIZES[size] * POSTER_SCALE,
      })),
    ),
  );
}
