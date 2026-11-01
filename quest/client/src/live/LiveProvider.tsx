import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Milestone, QuestAction, Snapshot } from "@quest/contract";
import { pageHidden } from "../lib/page";
import { SHOWN_CHANNEL, createShownEvents, type EventFeed } from "./events";
import {
  createLiveStore,
  type ActOutcome,
  type Connection,
  type LiveState,
  type LiveStore,
} from "./store";

/** The page's store, on the browser's stream, ledger, clock and fetch. */
function pageStore(): LiveStore {
  return createLiveStore({
    EventSource: typeof EventSource === "function" ? EventSource : null,
    setTimeout: (run, ms) => window.setTimeout(run, ms),
    clearTimeout: (handle) => {
      window.clearTimeout(handle as number);
    },
    hidden: pageHidden,
    onVisibility: (changed) => {
      document.addEventListener("visibilitychange", changed);
      return () => {
        document.removeEventListener("visibilitychange", changed);
      };
    },
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
    shown: () =>
      createShownEvents(
        typeof BroadcastChannel === "function"
          ? new BroadcastChannel(SHOWN_CHANNEL)
          : null,
        "locks" in navigator ? navigator.locks : null,
      ),
  });
}

/** Outside the provider (the Pip Playground, a component on its own) the page is offline: waiting, with no events. */
const OFFLINE: LiveState = {
  snapshot: null,
  connection: "waiting",
  pending: new Set(),
  actionsEnabled: false,
  milestone: null,
};
const offline: LiveStore = {
  subscribe: () => () => undefined,
  getState: () => OFFLINE,
  feed: { subscribe: () => () => undefined },
  act: () => Promise.resolve({ applied: false }),
  showMilestone: () => Promise.resolve(false),
  serverNow: () => Date.now(),
  connect: () => () => undefined,
};

const LiveContext = createContext<LiveStore>(offline);

/**
 * The page's connection to Claude Code Quest: one store for the page,
 * connected while mounted, read through the hooks below.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [store] = useState(pageStore);
  useEffect(() => store.connect(), [store]);
  return <LiveContext value={store}>{children}</LiveContext>;
}

function useLive<T>(read: (state: LiveState) => T): T {
  const store = useContext(LiveContext);
  return useSyncExternalStore(store.subscribe, () => read(store.getState()));
}

/** The snapshot on screen, or null before the first one. */
export function useSnapshot(): Snapshot | null {
  return useLive((state) => state.snapshot);
}

export function useConnection(): Connection {
  return useLive((state) => state.connection);
}

/** Whether actions may be sent: off while waiting and from a drop. */
export function useActionsEnabled(): boolean {
  return useLive((state) => state.actionsEnabled);
}

/** Sends actions, and tells whether one is in flight under its key. */
export function useAct(): {
  act: (action: QuestAction, key?: string) => Promise<ActOutcome>;
  pending: (key: string) => boolean;
} {
  const store = useContext(LiveContext);
  const inFlight = useLive((state) => state.pending);
  const pending = useCallback((key: string) => inFlight.has(key), [inFlight]);
  return { act: store.act, pending };
}

/**
 * The oldest pending milestone no tab has shown, and `show`, which claims it
 * for this tab: show it only when `show` resolves to true.
 */
export function useMilestone(): {
  milestone: Milestone | null;
  show: (id: string) => Promise<boolean>;
} {
  const store = useContext(LiveContext);
  const milestone = useLive((state) => state.milestone);
  return { milestone, show: store.showMilestone };
}

/** The events for the page's consumers, each ID at most once across tabs. */
export function useLiveFeed(): EventFeed {
  return useContext(LiveContext).feed;
}
