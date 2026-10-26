import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { Notice } from "../components/Notice";
import { useHeightProperty } from "../lib/height-property";
import { PipStageProvider } from "../pip/PipStage";
import { TopBar } from "./TopBar";

/**
 * Every screen's frame: the top bar (left out on Welcome, where Pip and one
 * action stand alone), the connection notice under it, and the screen itself, which
 * enters with a short rise. Pip's stage spans every screen, so one director
 * follows the Learner from screen to screen. After a route change the window scrolls to the top
 * and focus moves to the new screen's heading. The sticky top's height feeds
 * the page's scroll padding, so focus never lands behind it.
 */
export function Shell() {
  const location = useLocation();
  const screen = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  useHeightProperty(top, "--top-height");
  const firstRender = useRef(true);
  const welcome = location.pathname === "/";

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
    <PipStageProvider>
      <div className="min-h-dvh bg-bg bg-(image:--glow) bg-no-repeat">
        {/* The top bar and the connection notice under it stay at the top of the window together, outside the animated screen. */}
        <div ref={top} data-top="" className="sticky top-0 z-20">
          {!welcome && <TopBar />}
          {/* The connection layer feeds this from the event stream; until then the app is never disconnected. */}
          <Notice kind={null} />
        </div>
        <div
          ref={screen}
          key={location.pathname}
          data-screen=""
          className="animate-rise"
        >
          <Outlet />
        </div>
      </div>
    </PipStageProvider>
  );
}
