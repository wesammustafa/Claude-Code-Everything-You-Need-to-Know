import { useEffect, useRef, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { Notice, type NoticeKind } from "../components/Notice";
import { useHeightProperty } from "../lib/height-property";
import { LiveProvider, useConnection } from "../live/LiveProvider";
import type { Connection } from "../live/store";
import { PipStageProvider } from "../pip/PipStage";
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

/** The page's connection, around everything the shell shows. */
export function Shell() {
  return (
    <LiveProvider>
      <PipStageProvider>
        <Frame />
      </PipStageProvider>
    </LiveProvider>
  );
}

/**
 * Every screen's frame: the top bar (left out on Welcome, where Pip and one
 * action stand alone), the connection notice under it, and the screen itself, which
 * enters with a short rise. Pip's stage spans every screen, so one director
 * follows the Learner from screen to screen. After a route change the window scrolls to the top
 * and focus moves to the new screen's heading. The sticky top's height feeds
 * the page's scroll padding, so focus never lands behind it. Until the first
 * snapshot, once that wait is noticeable, the screen is marked busy
 * (`aria-busy`, `data-connection="waiting"`) for the styles to show.
 */
function Frame(): ReactNode {
  const location = useLocation();
  const screen = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  useHeightProperty(top, "--top-height");
  const firstRender = useRef(true);
  const welcome = location.pathname === "/";
  const connection = useConnection();
  const longWait = useLongWait(connection);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    screen.current
      ?.querySelector<HTMLElement>("[data-page-title]")
      ?.focus({ preventScroll: true });
  }, [location.pathname]);

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
