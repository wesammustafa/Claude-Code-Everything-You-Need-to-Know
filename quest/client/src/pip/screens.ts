import type { PipScreen } from "./director";

/**
 * The screen a route shows, by the director's names. Welcome is the index;
 * a Lesson's overview is its intro, then its step and its complete screen.
 * Journey is the map; Progress is its own. The rest are other screens.
 */
export function screenFor(pathname: string): PipScreen {
  if (pathname === "/") return "welcome";
  if (pathname === "/journey") return "map";
  if (pathname === "/progress") return "progress";
  if (/^\/lesson\/[^/]+\/?$/.test(pathname)) return "intro";
  if (/^\/lesson\/[^/]+\/step\/?$/.test(pathname)) return "step";
  if (/^\/lesson\/[^/]+\/complete\/?$/.test(pathname)) return "complete";
  return "other";
}
