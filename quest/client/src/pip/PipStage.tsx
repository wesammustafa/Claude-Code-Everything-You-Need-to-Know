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
import {
  SHOWN_CHANNEL,
  createLocalEventFeed,
  createShownEvents,
  onceAcrossTabs,
  type EventFeed,
} from "../live/events";
import { motionReduced, pageHidden, useReducedMotion } from "../lib/page";
import type { DirectorInput, LookTarget } from "./director";
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

/** Input that counts as the Learner's activity: pointing, typing, scrolling. */
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
/** Activity is passed on at most this often; it only keeps Pip from resting. */
const ACTIVITY_MS = 1000;

/**
 * The event feed Pip's director hears, each event ID at most once across the
 * page's tabs. Until the connection layer (ticket 220) it is the page's local
 * source; 220 swaps in the stream here.
 */
function openFeed(): { feed: EventFeed; close: () => void } {
  const shown = createShownEvents(
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel(SHOWN_CHANNEL)
      : null,
    "locks" in navigator ? navigator.locks : null,
  );
  return {
    feed: onceAcrossTabs(
      createLocalEventFeed(window),
      shown,
      () => !pageHidden(),
    ),
    close: () => {
      shown.close();
    },
  };
}

/**
 * Pip's stage for the app: one director for the page, fed the screen, the
 * page's visibility, reduced motion, the Learner's activity and the events,
 * and read by every Pip on screen.
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

  useEffect(() => {
    const { feed, close } = openFeed();
    const unsubscribe = feed.subscribe((events) => {
      // Where the hint and the other targets sit now, for Pip's gaze.
      stage.send({
        type: "gazeTargets",
        targets: measureGazeTargets(document),
      });
      stage.send({ type: "events", events });
    });
    return () => {
      unsubscribe();
      close();
    };
  }, [stage]);

  return <StageContext value={stage}>{children}</StageContext>;
}
