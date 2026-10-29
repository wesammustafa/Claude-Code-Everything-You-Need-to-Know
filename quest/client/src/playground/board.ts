// Crops of Pip's approved board, for reviewing the rig beside the art it is
// held to. The board is the owner's private art: it is never committed and
// never built. The dev server serves it at BOARD_URL when it is on this
// machine (build/playground-board.ts), and the Playground cuts each crop out
// of it in the browser, so no crop is ever a file.
import type { PipMode, PipReactionKind } from "../../pip/contract";

/** Where the dev server serves the board; build/playground-board.ts answers it. */
export const BOARD_URL = "/@playground/board.png";

/** The board's size in its own pixels. */
export const BOARD_SIZE = { width: 1536, height: 1024 } as const;

export type BoardCropId =
  | "meet"
  | "idle"
  | "happy"
  | "curious"
  | "thinking"
  | "celebration"
  | "focused"
  | "surprised"
  | "sleeping"
  | "explaining"
  | "encouraging"
  | "helping"
  | "working"
  | "front"
  | "three-quarter"
  | "side"
  | "back"
  | "in-context"
  | "icons";

export interface BoardCrop {
  id: BoardCropId;
  /** The board's own caption. */
  caption: string;
  /** The crop's box in the board's pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Each crop's caption and box: left, top, right, bottom in the board's pixels. */
const CROPS: Readonly<
  Record<BoardCropId, readonly [string, number, number, number, number]>
> = {
  meet: ["Meet Pip", 305, 85, 600, 365],
  idle: ["Idle", 725, 55, 875, 200],
  happy: ["Happy", 905, 50, 1100, 200],
  curious: ["Curious", 1140, 45, 1295, 200],
  thinking: ["Thinking", 1345, 45, 1500, 200],
  celebration: ["Celebration", 715, 240, 900, 400],
  focused: ["Focused", 925, 270, 1105, 410],
  surprised: ["Surprised", 1150, 255, 1300, 410],
  sleeping: ["Idle (Sleeping)", 1340, 260, 1505, 410],
  explaining: ["Explaining", 8, 462, 436, 768],
  encouraging: ["Encouraging", 447, 462, 857, 772],
  helping: ["Helping", 868, 462, 1171, 772],
  working: ["Working Together", 1182, 462, 1528, 772],
  front: ["Front", 25, 825, 170, 975],
  "three-quarter": ["3/4", 195, 825, 345, 975],
  side: ["Side", 385, 825, 490, 975],
  back: ["Back", 530, 825, 680, 975],
  "in-context": ["In Context (UI)", 720, 785, 1188, 1012],
  icons: ["Small Size Icons", 1205, 840, 1525, 950],
};

function crop(id: BoardCropId): BoardCrop {
  const [caption, left, top, right, bottom] = CROPS[id];
  return {
    id,
    caption,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/** The board's sections, in its own order. */
export const BOARD_SECTIONS: readonly {
  title: string;
  crops: readonly BoardCrop[];
}[] = [
  { title: "Meet Pip", crops: [crop("meet")] },
  {
    title: "Expressions and emotions",
    crops: (
      [
        "idle",
        "happy",
        "curious",
        "thinking",
        "celebration",
        "focused",
        "surprised",
        "sleeping",
      ] as const
    ).map(crop),
  },
  {
    title: "Scenes",
    crops: (["explaining", "encouraging", "helping", "working"] as const).map(
      crop,
    ),
  },
  {
    title: "Turnaround",
    crops: (["front", "three-quarter", "side", "back"] as const).map(crop),
  },
  {
    title: "In context and small sizes",
    crops: [crop("in-context"), crop("icons")],
  },
];

/**
 * The board's art for each mode and Reaction: what the rig is held to. Retry
 * is a brief surprise, then reassurance; Rest is a calm, awake Idle and
 * Sleep the sleeping pose.
 */
export const BOARD_FOR: Readonly<
  Record<PipMode | PipReactionKind, readonly BoardCrop[]>
> = {
  idle: [crop("idle")],
  thinking: [crop("thinking"), crop("focused")],
  rest: [crop("idle")],
  sleep: [crop("sleeping")],
  greeting: [crop("meet")],
  curious: [crop("curious")],
  explaining: [crop("explaining"), crop("helping")],
  success: [crop("happy"), crop("encouraging")],
  retry: [crop("surprised")],
  celebration: [crop("celebration")],
};

/** The board's small icons (64, 32 and 16 px), for the icon size. */
export const ICONS: BoardCrop = crop("icons");

export type BoardState = "loading" | "ready" | "missing";

let state: BoardState = "loading";
let asked = false;
const listeners = new Set<() => void>();

function settle(next: BoardState) {
  state = next;
  for (const listener of [...listeners]) listener();
}

/** Whether the dev server has the board, asked once per page load. */
export function subscribeBoard(listener: () => void): () => void {
  listeners.add(listener);
  if (!asked) {
    asked = true;
    fetch(BOARD_URL, { method: "HEAD", cache: "no-store" }).then(
      (response) => {
        settle(response.ok ? "ready" : "missing");
      },
      () => {
        settle("missing");
      },
    );
  }
  return () => {
    listeners.delete(listener);
  };
}

export const boardState = (): BoardState => state;

/** For tests: forget the answer, so the next subscriber asks again. */
export function resetBoardForTests(): void {
  state = "loading";
  asked = false;
}
