import type { ReactNode } from "react";
import { Badge, type BadgeShape, type BadgeSize } from "./Badge";

// The 23 Badges: a shape per Level, a stroke symbol per Lesson on a 24 grid,
// and the capstones larger with a star. The names stay in the step files.

export type RegularLessonId =
  | "b-1"
  | "b-2"
  | "b-3"
  | "b-4"
  | "b-5"
  | "i-1"
  | "i-2"
  | "i-3"
  | "i-4"
  | "i-5"
  | "i-6"
  | "i-7"
  | "i-8"
  | "a-1"
  | "a-2"
  | "a-3"
  | "a-4"
  | "a-5"
  | "a-6"
  | "a-7";

export type CapstoneId = "b-capstone" | "i-capstone" | "a-capstone";

export type LessonId = RegularLessonId | CapstoneId;

// From the design system study (research/21-design-system), with Warden
// redrawn as a fence, so an earned Badge never reads as a barred door.
export const BADGE_SYMBOLS: Record<RegularLessonId, ReactNode> = {
  // Explorer: a compass.
  "b-1": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  // Planner: a clipboard.
  "b-2": (
    <>
      <rect x="6" y="4.5" width="12" height="16" rx="2" />
      <path d="M9.5 4.5h5v2.5h-5zM9 11h6M9 15h4" />
    </>
  ),
  // Builder: bricks.
  "b-3": (
    <>
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
      <path d="M4 12h16M12 6v6M8 12v6M16 12v6" />
    </>
  ),
  // Navigator: a route between two points.
  "b-4": (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" />
    </>
  ),
  // Keeper: a bookmark.
  "b-5": <path d="M6.5 4h11v16.5L12 16.8 6.5 20.5z" />,
  // Crafter: a wand with sparks.
  "i-1": (
    <>
      <path d="M5 19 15 9" />
      <path d="m14 3.5 1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 12l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </>
  ),
  // Organizer: stacked layers.
  "i-2": (
    <>
      <path d="m12 4-8.5 4.5L12 13l8.5-4.5z" />
      <path d="m3.5 13 8.5 4.5 8.5-4.5" />
    </>
  ),
  // Tuner: sliders.
  "i-3": (
    <path d="M4 7h9M17 7h3M15 5v4M4 12h3M11 12h9M9 10v4M4 17h11M19 17h1M17 15v4" />
  ),
  // Guardian: a shield with a tick.
  "i-4": (
    <>
      <path d="M12 3.5 18.5 6v5.5c0 4.2-2.8 7.2-6.5 8.5-3.7-1.3-6.5-4.3-6.5-8.5V6z" />
      <path d="m9.3 12 1.9 1.9 3.5-3.6" />
    </>
  ),
  // Enforcer: a bolt.
  "i-5": <path d="M13 3 6 13.5h5l-1 7.5 7-10.5h-5z" />,
  // Delegator: two people.
  "i-6": (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5c.4-3 2.7-4.8 5.5-4.8c2.8 0 5.1 1.8 5.5 4.8" />
      <circle cx="17" cy="9.5" r="2.3" />
      <path d="M16 14.6c2.5 0 4.3 1.5 4.6 4.4" />
    </>
  ),
  // Connector: a plug.
  "i-7": <path d="M9 3v4.5M15 3v4.5M7 7.5h10v3a5 5 0 0 1-10 0zM12 15.5V21" />,
  // Curator: a box.
  "i-8": (
    <>
      <path d="m12 3-8 4v10l8 4 8-4V7z" />
      <path d="m4 7 8 4 8-4M12 11v10" />
    </>
  ),
  // Brancher: a branch.
  "a-1": (
    <>
      <circle cx="6.5" cy="5" r="2" />
      <circle cx="6.5" cy="19" r="2" />
      <circle cx="17.5" cy="7.5" r="2" />
      <path d="M6.5 7v10M17.5 9.5c0 4-5 4.5-11 7.5" />
    </>
  ),
  // Strategist: a flag.
  "a-2": <path d="M6 21V4M6 4h10.5l-2 4 2 4H6" />,
  // Orchestrator: three joined boxes.
  "a-3": (
    <>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="9" y="14.5" width="6" height="6" rx="1.5" />
      <path d="M6.5 9.5v1.5a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V9.5M12 13v1.5" />
    </>
  ),
  // Scripter: a terminal.
  "a-4": (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="m7 9.5 3 2.5-3 2.5M12.5 15H17" />
    </>
  ),
  // Automator: a loop with play.
  "a-5": (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.8-6.3L20.5 8" />
      <path d="M20.5 3.5V8H16M10.5 9.5l4 2.5-4 2.5z" />
    </>
  ),
  // Steward: a shared node.
  "a-6": (
    <>
      <circle cx="18" cy="5.5" r="2.3" />
      <circle cx="6" cy="12" r="2.3" />
      <circle cx="18" cy="18.5" r="2.3" />
      <path d="m8.1 10.9 7.8-4.3M8.1 13.1l7.8 4.3" />
    </>
  ),
  // Warden: a fence of two pickets and two rails.
  "a-7": (
    <path d="M6 20V8l2-2.5L10 8v12M14 20V8l2-2.5L16 8v12M4 11h16M4 16h16" />
  ),
};

/** A capstone's symbol. */
export const BADGE_STAR: ReactNode = (
  <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
);

/** Each Level's shape, by the Lesson id's prefix. */
export const LEVEL_SHAPE: Record<"b" | "i" | "a", BadgeShape> = {
  b: "circle",
  i: "hexagon",
  a: "shield",
};

const levelShape = (id: string): BadgeShape | undefined =>
  (LEVEL_SHAPE as Record<string, BadgeShape | undefined>)[
    id.split("-")[0] ?? ""
  ];

/** A Lesson's Badge art, or undefined for an id the course does not have. */
export function badgeArt(
  id: string,
): { shape: BadgeShape; capstone: boolean; symbol: ReactNode } | undefined {
  const shape = levelShape(id);
  if (shape === undefined) return undefined;
  if (id.endsWith("-capstone"))
    return { shape, capstone: true, symbol: BADGE_STAR };
  const symbol = (BADGE_SYMBOLS as Record<string, ReactNode>)[id];
  return symbol === undefined ? undefined : { shape, capstone: false, symbol };
}

export interface LessonBadgeProps {
  lesson: string;
  /** The step file's `badge`; null shows nothing, as there is nothing to name. */
  name: string | null;
  earned: boolean;
  size?: BadgeSize;
  reveal?: boolean;
  caption?: boolean;
}

/**
 * A Lesson's Badge by its id. An id the course does not have still shows its
 * Level's shape (a circle when even that is unknown), with no symbol.
 */
export function LessonBadge({ lesson, name, ...rest }: LessonBadgeProps) {
  if (name === null) return null;
  const art = badgeArt(lesson);
  return (
    <Badge
      {...rest}
      name={name}
      shape={art?.shape ?? levelShape(lesson) ?? "circle"}
      capstone={art?.capstone ?? false}
      symbol={art?.symbol}
    />
  );
}
