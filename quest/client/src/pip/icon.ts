// Pip's icon: a hand-made front view traced from the approved board's small
// icons, for 32 px and below, where the rig is never shown. The block head
// turns a little toward the content on its right, so its shaded side shows on
// the left, as on the board. Every coordinate is even on the 32 grid, so
// each straight edge lands on a whole pixel at 16 and 32 px; only the
// diagonals of the cut corners blend. Each tip, three pixels wide at 16 px,
// centres over its one-pixel stalk. PipIcon draws these parts in tokens;
// public/favicon.svg repeats them with the tokens' values.

/** The colour each part takes: the head, its shaded side, or the eyes. */
export type PipIconTone = "body" | "shade" | "eye";

export interface PipIconPart {
  tone: PipIconTone;
  d: string;
}

export const PIP_ICON_VIEW_BOX = "0 0 32 32";

/** Back to front: each part is painted over the ones before it. */
export const PIP_ICON_PARTS: readonly PipIconPart[] = [
  // The antenna stalks, then the tips centred over them.
  { tone: "shade", d: "M12 4h2v4h-2zM22 4h2v4h-2z" },
  { tone: "body", d: "M10 0h6v4h-6zM20 0h6v4h-6z" },
  // The head with its corners cut, then its front face over all but the left side.
  { tone: "shade", d: "M6 8H26L30 12V26L26 30H6L2 26V12Z" },
  { tone: "body", d: "M8 8H26L30 12V26L26 30H8Z" },
  // The two eye bars, set toward the content.
  { tone: "eye", d: "M14 14h4v10h-4zM22 14h4v10h-4z" },
];

/** Each tone's colour token, without its --color- prefix. */
export const PIP_ICON_TOKENS: Readonly<Record<PipIconTone, string>> = {
  body: "pip",
  shade: "pip-shade",
  eye: "pip-eye",
};

/** What each tone is seen against: the eyes sit on the face, the rest on the page. */
export const PIP_ICON_GROUND: Readonly<
  Record<PipIconTone, PipIconTone | null>
> = {
  body: null,
  shade: null,
  eye: "body",
};
