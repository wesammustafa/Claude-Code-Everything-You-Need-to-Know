import { useEffect, useState } from "react";
import type { BeatView } from "@quest/contract";

/** A Check shorter than this shows no seconds at all. */
const SHOW_FROM_S = 3;
/** Up to here the seconds count one by one, then five at a time. */
const FINE_UNTIL_S = 10;
const COARSE_STEP_S = 5;

/** The next second to show after `shown`, or the first one. */
function nextShown(shown: number | null): number {
  if (shown === null) return SHOW_FROM_S;
  if (shown < FINE_UNTIL_S) return shown + 1;
  return shown + COARSE_STEP_S;
}

/**
 * The seconds a slow Check has been running, as the bubble shows them: null
 * before 3 s, then every second to 10 s, then every 5 s. The clock is the
 * browser's own: it starts when the snapshot says the beat is checking and
 * stops at any other status, so it times what the browser saw, not the
 * check's own process.
 */
export function useCheckClock(status: BeatView["status"]): number | null {
  const running = status === "checking";
  const [shown, setShown] = useState<number | null>(null);
  const [wasRunning, setWasRunning] = useState(running);
  if (running !== wasRunning) {
    setWasRunning(running);
    setShown(null);
  }

  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let at: number | null = null;
    let timer = 0;
    const schedule = () => {
      const next = nextShown(at);
      timer = window.setTimeout(
        () => {
          at = next;
          setShown(next);
          schedule();
        },
        Math.max(0, started + next * 1000 - performance.now()),
      );
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
    };
  }, [running]);

  return running ? shown : null;
}
