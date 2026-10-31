import type { PipScreen } from "./director";

/**
 * The screen a route shows, by the director's names. Welcome is the index;
 * a Lesson's overview is its intro, then its step and its complete screen.
 * Journey is the map; Progress is its own. The rest are other screens.
 * A Step-down shows on the step's route, so the snapshot's phase tells it
 * apart: there Pip is on his Level-up moment.
 */
export function screenFor(pathname: string, phase?: string): PipScreen {
  if (pathname === "/") return "welcome";
  if (pathname === "/journey") return "map";
  if (pathname === "/progress") return "progress";
  if (/^\/lesson\/[^/]+\/?$/.test(pathname)) return "intro";
  if (/^\/lesson\/[^/]+\/step\/?$/.test(pathname))
    return phase === "step-down" ? "levelup" : "step";
  if (/^\/lesson\/[^/]+\/complete\/?$/.test(pathname)) return "complete";
  return "other";
}
