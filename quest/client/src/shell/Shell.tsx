import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Outlet, useLocation } from "react-router";
import { Notice, type NoticeKind } from "../components/Notice";
import { useHeightProperty } from "../lib/height-property";
import { LiveProvider, useConnection } from "../live/LiveProvider";
import type { Connection } from "../live/store";
import { PagePanelProvider } from "../pages/PagePanel";
import { PipStageProvider } from "../pip/PipStage";
import { useCourseSnapshot } from "../screens/lesson";
import { useLessonRoute } from "../screens/useLessonRoute";
import { TopBar } from "./TopBar";

/** How long the wait for the first snapshot lasts before the screen says it is busy, so a snapshot that comes at once shows no flash. */
export const WAITING_MS = 150;

const NOTICES: Record<Connection, NoticeKind | null> = {
  waiting: null,
  connected: null,
  reconnecting: "reconnecting",
  stopped: "stopped",
};

/** Whether the page has waited WAITING_MS for its first snapshot and still waits. */
function useLongWait(connection: Connection): boolean {
  const [long, setLong] = useState(false);
  const waiting = connection === "waiting";
  useEffect(() => {
    // The page never waits again once its first snapshot came.
    if (!waiting) return;
    const timer = setTimeout(() => {
      setLong(true);
    }, WAITING_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [waiting]);
  return waiting && long;
}

/**
 * Where the Learner is inside a Lesson's route: its phase, step and beat.
 * Every step and every Step-down share one path, so a change here is a new
 * screen too. Null off a Lesson's route, so a snapshot never moves focus on
 * Welcome, the journey or Progress.
 */
function useLessonPlace(pathname: string): string | null {
  const lesson = useCourseSnapshot()?.lesson;
  if (!lesson || !pathname.startsWith("/lesson/")) return null;
  const at =
    lesson.phase === "playing"
      ? `${lesson.step?.id ?? ""}:${String(lesson.beat?.index ?? "")}`
      : "";
  return `${lesson.id}:${lesson.phase}:${at}`;
}

/**
 * After a new screen (a route change, or a new step, beat or Step-down on
 * the same route) the window scrolls to the top and focus moves to the
 * screen's heading. A screen still waiting for its snapshot has no heading
 * yet, so focus waits for the place to settle and moves then. The first
 * render moves nothing.
 */
function useScreenFocus(
  screen: RefObject<HTMLDivElement | null>,
  pathname: string,
): void {
  const place = useLessonPlace(pathname);
  const last = useRef({ pathname, place });
  const wantsFocus = useRef(false);
  useEffect(() => {
    const before = last.current;
    last.current = { pathname, place };
    const moved =
      before.pathname !== pathname ||
      (before.place !== null && before.place !== place);
    if (moved) {
      window.scrollTo({ top: 0 });
      wantsFocus.current = true;
    }
    if (!wantsFocus.current) return;
    const title =
      screen.current?.querySelector<HTMLElement>("[data-page-title]") ?? null;
    if (title === null) return;
    wantsFocus.current = false;
    title.focus({ preventScroll: true });
  }, [screen, pathname, place]);
}

/** The page's connection, around everything the shell shows. */
export function Shell() {
  return (
    <LiveProvider>
      <PipStageProvider>
        <PagePanelProvider>
          <Frame />
        </PagePanelProvider>
      </PipStageProvider>
    </LiveProvider>
  );
}

/**
 * Every screen's frame: the top bar (left out on Welcome, where Pip and one
 * action stand alone), the connection notice under it, and the screen itself, which
 * enters with a short rise. Pip's stage spans every screen, so one director
 * follows the Learner from screen to screen. After a new screen the window scrolls to the top
 * and focus moves to its heading (useScreenFocus). The sticky top's height feeds
 * the page's scroll padding, so focus never lands behind it. Until the first
 * snapshot, once that wait is noticeable, the screen is marked busy
 * (`aria-busy`, `data-connection="waiting"`) for the styles to show. On a
 * Lesson's route the path follows the engine's place (useLessonRoute).
 */
function Frame(): ReactNode {
  const location = useLocation();
  const screen = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  useHeightProperty(top, "--top-height");
  const welcome = location.pathname === "/";
  const connection = useConnection();
  const longWait = useLongWait(connection);
  useLessonRoute();
  useScreenFocus(screen, location.pathname);

  return (
    <div className="min-h-dvh bg-bg bg-(image:--glow) bg-no-repeat">
      {/* The top bar and the connection notice under it stay at the top of the window together, outside the animated screen. */}
      <div ref={top} data-top="" className="sticky top-0 z-20">
        {!welcome && <TopBar />}
        <Notice kind={NOTICES[connection]} />
      </div>
      <div
        ref={screen}
        key={location.pathname}
        data-screen=""
        {...(longWait
          ? { "aria-busy": true, "data-connection": "waiting" }
          : {})}
        className="animate-rise"
      >
        <Outlet />
      </div>
    </div>
  );
}
