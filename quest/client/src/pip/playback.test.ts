import { describe, expect, test, vi } from "vitest";
import { REACTION_POSTER_MS, createReactionLedger } from "./playback";

/** A clock the test moves by hand, running timers as their time comes. */
function fakeClock() {
  let now = 0;
  const timers: { at: number; run: () => void }[] = [];
  return {
    now: () => now,
    setTimeout(run: () => void, ms: number) {
      timers.push({ at: now + ms, run });
    },
    advance(ms: number) {
      now += ms;
      for (const timer of timers.filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.run();
      }
    },
  };
}

describe("the Reaction ledger", () => {
  test("starts a Reaction once, however often it is asked", () => {
    const ledger = createReactionLedger(fakeClock());
    ledger.arrive("e.1");
    expect(ledger.start("e.1")).toBe(true);
    expect(ledger.start("e.1")).toBe(false);
    // A Reaction the ledger never saw arrives as it is started.
    expect(ledger.start("e.2")).toBe(true);
    expect(ledger.start("e.2")).toBe(false);
  });

  test("a Reaction that waited for the runtime still starts, however long it waited", () => {
    const clock = fakeClock();
    const ledger = createReactionLedger(clock);
    ledger.arrive("e.1");
    clock.advance(60_000);
    expect(ledger.start("e.1")).toBe(true);
    expect(ledger.start("e.1")).toBe(false);
  });

  test("a spent Reaction never starts", () => {
    const ledger = createReactionLedger(fakeClock());
    ledger.arrive("e.1");
    ledger.spend("e.1");
    expect(ledger.start("e.1")).toBe(false);
    // Spending one the ledger never saw records it, spent.
    ledger.spend("e.2");
    expect(ledger.holding("e.2")).toBe(true);
    expect(ledger.start("e.2")).toBe(false);
  });

  test("holds a Reaction's poster for REACTION_POSTER_MS, then tells its listeners", () => {
    const clock = fakeClock();
    const ledger = createReactionLedger(clock);
    const listener = vi.fn();
    const stop = ledger.subscribe(listener);
    expect(ledger.holding("e.1")).toBe(false);
    ledger.arrive("e.1");
    expect(ledger.holding("e.1")).toBe(true);
    clock.advance(REACTION_POSTER_MS - 1);
    expect(ledger.holding("e.1")).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    clock.advance(1);
    expect(ledger.holding("e.1")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    ledger.arrive("e.2");
    clock.advance(REACTION_POSTER_MS);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("remembers only the newest 64 Reactions", () => {
    const clock = fakeClock();
    const ledger = createReactionLedger(clock);
    for (let i = 0; i <= 64; i++) ledger.arrive(`e.${String(i)}`);
    expect(ledger.holding("e.0")).toBe(false);
    expect(ledger.holding("e.1")).toBe(true);
    expect(ledger.holding("e.64")).toBe(true);
  });
});
