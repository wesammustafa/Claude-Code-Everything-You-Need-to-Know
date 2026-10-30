import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import type { PipModel } from "../../pip/contract";
import { useConnection, useLiveFeed } from "../live/LiveProvider";
import { motionReduced, pageHidden, useReducedMotion } from "../lib/page";
import type { DirectorInput, LookTarget } from "./director";
import { followPointer } from "./pointer";
import { screenFor } from "./screens";
import {
  createPipStage,
  measureGaze,
  measureGazeTargets,
  type PipStage,
  type StageClock,
} from "./stage";

const pageClock: StageClock = {
  now: () => performance.now(),
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/** Outside a stage (a component on its own, in a test) Pip holds Idle. */
const STILL: PipModel = {
  mode: "idle",
  reaction: null,
  gaze: null,
  restingGaze: { x: 0, y: 0 },
  reducedMotion: false,
  size: "beside",
};
const stillStage: PipStage = {
  model: () => STILL,
  helpShowing: () => false,
  send: () => undefined,
  subscribe: () => () => undefined,
};

const StageContext = createContext<PipStage>(stillStage);

/** The director's current model. */
export function usePipModel(): PipModel {
  const stage = useContext(StageContext);
  return useSyncExternalStore(stage.subscribe, stage.model);
}

/** Tells the director something the page learned. */
export function usePipInput(): (input: DirectorInput) => void {
  return useContext(StageContext).send;
}

/** Whether the step's help offer is in Pip's bubble. */
export function useHelpShowing(): boolean {
  const stage = useContext(StageContext);
  return useSyncExternalStore(stage.subscribe, stage.helpShowing);
}

/**
 * Has Pip watch what the Learner just did: the element marked
 * `data-pip-target` with that name around `from` (the Copy button pressed,
 * say), or else the page's first one. Nothing without a Pip on the page.
 */
export function usePipLook(): (
  target: LookTarget,
  from?: Element | null,
) => void {
  const send = usePipInput();
  return useCallback(
    (target, from) => {
      const selector = `[data-pip-target="${target}"]`;
      const el = from?.closest(selector) ?? document.querySelector(selector);
      if (el === null) return;
      const at = measureGaze(document, el);
      if (at !== null) send({ type: "look", target, at });
    },
    [send],
  );
}

/**
 * Tells the director which step is on screen, and whether an unopened hint is
 * ready on it, for the help offer's stuck rule.
 */
export function usePipStep(step: string | null, hintReady: boolean): void {
  const send = usePipInput();
  useEffect(() => {
    send({ type: "step", step });
    return () => {
      send({ type: "step", step: null });
    };
  }, [send, step]);
  useEffect(() => {
    send({ type: "hint", ready: hintReady });
  }, [send, step, hintReady]);
}

/**
 * Has the page's Pip follow the mouse: where it moves goes to the director
 * at most once per animation frame, and nothing runs while it is still or
 * Pip holds still. The director decides whether Pip follows it.
 */
export function usePipFollowsPointer(): void {
  const stage = useContext(StageContext);
  useEffect(() => {
    if (stage === stillStage) return;
    return followPointer(window, {
      pip: () => document.querySelector("[data-pip]"),
      still: () => stage.model().reducedMotion,
      send: stage.send,
    });
  }, [stage]);
}

/** Input that counts as the Learner's activity: pointing, typing, scrolling. */
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
/** Activity is passed on at most this often; it only keeps Pip from resting. */
const ACTIVITY_MS = 1000;

/**
 * Pip's stage for the app: one director for the page, fed the screen, the
 * page's visibility, reduced motion, the Learner's activity, the events and
 * whether the connection is lost, and read by every Pip on screen.
 */
export function PipStageProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [stage] = useState(() =>
    createPipStage(pageClock, {
      screen: screenFor(pathname),
      reducedMotion: motionReduced(),
      hidden: pageHidden(),
    }),
  );

  useEffect(() => {
    stage.send({ type: "screen", screen: screenFor(pathname) });
  }, [stage, pathname]);

  const reducedMotion = useReducedMotion();
  useEffect(() => {
    stage.send({ type: "reducedMotion", on: reducedMotion });
  }, [stage, reducedMotion]);

  useEffect(() => {
    const changed = () => {
      stage.send({ type: "visibility", hidden: pageHidden() });
    };
    document.addEventListener("visibilitychange", changed);
    return () => {
      document.removeEventListener("visibilitychange", changed);
    };
  }, [stage]);

  useEffect(() => {
    let last = -Infinity;
    const active = () => {
      const now = pageClock.now();
      if (now - last < ACTIVITY_MS) return;
      last = now;
      stage.send({ type: "activity" });
    };
    const options = { capture: true, passive: true } as const;
    for (const type of ACTIVITY) window.addEventListener(type, active, options);
    return () => {
      for (const type of ACTIVITY)
        window.removeEventListener(type, active, options);
    };
  }, [stage]);

  // The stream's events, each ID at most once across the page's tabs.
  const feed = useLiveFeed();
  useEffect(
    () =>
      feed.subscribe((events) => {
        // Where the hint and the other targets sit now, for Pip's gaze.
        stage.send({
          type: "gazeTargets",
          targets: measureGazeTargets(document),
        });
        stage.send({ type: "events", events });
      }),
    [stage, feed],
  );

  // Pip rests while the connection is lost; waiting for the first snapshot is not lost.
  const connection = useConnection();
  const lost = connection === "reconnecting" || connection === "stopped";
  useEffect(() => {
    stage.send({ type: "connection", lost });
  }, [stage, lost]);

  return <StageContext value={stage}>{children}</StageContext>;
}
