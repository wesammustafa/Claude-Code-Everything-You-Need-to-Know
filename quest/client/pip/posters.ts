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

export interface Pose {
  /** View model values set before the scene runs; a trigger fires. */
  data: Partial<Record<PipProperty, string>>;
  /** How far the scene runs before the capture, as the CLI's --advance takes it. */
  advance: string;
}

/**
 * The poses: idle (one frame in, never the authored pose before anything
 * runs), thinking, a happy frame near the top of a full Success, and a
 * reassuring frame in Retry's nod.
 */
export const POSTER_POSES = {
  idle: { data: {}, advance: "1" },
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
export function posterFile(pose: PosterPose, size: PipSize): string {
  return `posters/${pose}-${size}.png`;
}

/**
 * Everything besides the rig that the posters are rendered from: their scale,
 * the sizes and the poses. pip:build records it, so CI sees a change here that
 * the committed posters do not show yet.
 */
export interface PosterSpec {
  scale: number;
  sizes: Readonly<Record<PipSize, number>>;
  poses: Readonly<Record<PosterPose, Pose>>;
}

export function posterSpec(): PosterSpec {
  return { scale: POSTER_SCALE, sizes: PIP_SIZES, poses: POSTER_POSES };
}

/** Every poster the build writes, with its pose and its size in device pixels. */
export function allPosters(): { file: string; pose: PosterPose; px: number }[] {
  return (Object.keys(POSTER_POSES) as PosterPose[]).flatMap((pose) =>
    (Object.keys(PIP_SIZES) as PipSize[]).map((size) => ({
      file: posterFile(pose, size),
      pose,
      px: PIP_SIZES[size] * POSTER_SCALE,
    })),
  );
}
