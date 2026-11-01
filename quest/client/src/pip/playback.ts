// What this tab has done with each Reaction the director handed Pip: when it
// arrived, whether the rig started it, and whether its poster still holds.
// One ledger per tab, outside React, so a Pip that mounts on the next screen
// never replays a Reaction the last one played.

/**
 * How long a Reaction's poster shows before the mode's returns: about the
 * rig's longest Reaction (Explaining, 96 frames at 60 fps).
 */
export const REACTION_POSTER_MS = 1600;

/** How many Reactions the ledger remembers; older ones are long over. */
const LIMIT = 64;

export interface LedgerClock {
  setTimeout(run: () => void, ms: number): unknown;
}

export interface ReactionLedger {
  /** Records a Reaction's arrival; only the first call for an ID counts. */
  arrive: (id: string) => void;
  /**
   * Whether the rig should start this Reaction now: it was never started or
   * spent. Either way it is spent from then on. A Reaction that arrived
   * while the runtime was still loading starts here once the rig binds, as
   * long as it is still the director's Reaction: one it replaced is never
   * asked for, so it never plays.
   */
  start: (id: string) => boolean;
  /**
   * Spends a Reaction without starting it: Pip showed its poster for good
   * when it came, so a rig that comes back later never replays it.
   */
  spend: (id: string) => void;
  /** Whether the Reaction's poster still holds. */
  holding: (id: string) => boolean;
  /** Called when a poster's hold ends. */
  subscribe: (listener: () => void) => () => void;
}

interface Entry {
  started: boolean;
  holding: boolean;
}

export function createReactionLedger(clock: LedgerClock): ReactionLedger {
  // Insertion order is age order.
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();

  const arrive = (id: string): Entry => {
    const known = entries.get(id);
    if (known) return known;
    const entry: Entry = { started: false, holding: true };
    entries.set(id, entry);
    while (entries.size > LIMIT) {
      const oldest = entries.keys().next();
      if (oldest.done === true) break;
      entries.delete(oldest.value);
    }
    clock.setTimeout(() => {
      entry.holding = false;
      for (const listener of [...listeners]) listener();
    }, REACTION_POSTER_MS);
    return entry;
  };

  return {
    arrive(id) {
      arrive(id);
    },
    start(id) {
      const entry = arrive(id);
      if (entry.started) return false;
      entry.started = true;
      return true;
    },
    spend(id) {
      arrive(id).started = true;
    },
    holding: (id) => entries.get(id)?.holding ?? false,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The tab's ledger, on the page's own clock. */
export const reactionLedger = createReactionLedger({
  setTimeout: (run, ms) => setTimeout(run, ms),
});
