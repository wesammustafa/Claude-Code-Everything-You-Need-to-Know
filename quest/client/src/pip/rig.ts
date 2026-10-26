// The renderer contract's two faces, as plain functions: the values the Rive
// adapter writes into Pip's view model, and the poster the static fallback
// shows, both read from one PipModel.
import type { PipMode, PipModel } from "../../pip/contract";
import {
  PIP_SIZES,
  POSTER_FOR,
  posterFile,
  type PosterPose,
} from "../../pip/posters";

/** Where Pip can show the rig or a poster: every size but the icon. */
export type RigSize = keyof typeof PIP_SIZES;

/** The view model's values for a model, by the contract's property names. */
export interface RigValues {
  mode: PipMode;
  gazeX: number;
  gazeY: number;
  reducedMotion: boolean;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * A null gaze is the centre: the rig's own small glances play around it, and
 * under reduced motion (where the director never sets a gaze) Pip holds still.
 */
export function rigValues(model: PipModel): RigValues {
  return {
    mode: model.mode,
    gazeX: model.gaze === null ? 0 : clamp(model.gaze.x),
    gazeY: model.gaze === null ? 0 : clamp(model.gaze.y),
    reducedMotion: model.reducedMotion,
  };
}

/**
 * The poster for a model: the Reaction's while its poster holds, otherwise
 * the mode's.
 */
export function posterPose(
  model: PipModel,
  reactionHolding: boolean,
): PosterPose {
  if (model.reaction !== null && reactionHolding)
    return POSTER_FOR[model.reaction.kind];
  return POSTER_FOR[model.mode];
}

// Every committed poster, by its path relative to quest/client/pip/.
const POSTER_URLS = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../../pip/posters/*.png", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.slice("../../pip/".length), url]),
);

/** The URL the build gave a poster. */
export function posterUrl(pose: PosterPose, size: RigSize): string {
  const url = POSTER_URLS[posterFile(pose, size)];
  if (url === undefined)
    throw new Error(`No poster ${posterFile(pose, size)} in the build`);
  return url;
}
