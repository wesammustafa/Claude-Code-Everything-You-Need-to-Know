import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAct, useActionsEnabled } from "../live/LiveProvider";
import { pathOf, summaryOf, useCourseSnapshot } from "./lesson";

const LESSON_ROUTE = /^\/lesson\/([^/]+)(?:\/(?:step|complete))?\/?$/;

/**
 * The engine owns the Learner's place; on a Lesson's route the browser
 * follows it. Mounted once, in the shell:
 * - on the active Lesson's route, the path follows its phase (overview, the
 *   workspace for play and a Step-down, or complete), replacing the entry;
 * - a route naming another Lesson of the course sends `lesson.open` for it,
 *   once, and the path follows when the snapshot moves there;
 * - a resume with no beat open yet sends `lesson.open` for it, once;
 * - a route naming no Lesson is left to the screens' NotFound.
 * Other routes (Welcome, Journey, Progress) are never moved.
 */
export function useLessonRoute(): void {
  const snapshot = useCourseSnapshot();
  const enabled = useActionsEnabled();
  const { act } = useAct();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // The Lesson last asked for, so a render never sends it twice.
  const asked = useRef<string | null>(null);

  const lesson = snapshot?.lesson;
  const routeId = LESSON_ROUTE.exec(pathname)?.[1];
  const known = summaryOf(snapshot, routeId) !== null;
  const waitsToOpen =
    lesson?.phase === "playing" &&
    lesson.step === null &&
    lesson.id === routeId;
  const target = lesson?.phase === undefined ? null : pathOf(lesson);

  useEffect(() => {
    if (routeId === undefined || !lesson?.phase || !known) return;
    if (routeId !== lesson.id || waitsToOpen) {
      if (!enabled || asked.current === routeId) return;
      asked.current = routeId;
      void act({ type: "lesson.open", lesson: routeId }, "lesson.open").then(
        (outcome) => {
          // A stale or lost answer asks once more on the next snapshot; a
          // refusal (a typed error) is final for this route.
          if (!outcome.applied && outcome.error === undefined)
            asked.current = null;
        },
      );
      return;
    }
    asked.current = null;
    if (target !== null && target !== pathname)
      void navigate(target, { replace: true });
  }, [
    act,
    enabled,
    known,
    lesson,
    navigate,
    pathname,
    routeId,
    target,
    waitsToOpen,
  ]);
}
