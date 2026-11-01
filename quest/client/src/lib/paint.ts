const FIRST_CONTENTFUL_PAINT = "first-contentful-paint";

/**
 * How long, in painted frames' time, to wait for the browser to record the
 * first contentful paint before going ahead anyway: by then the page has
 * painted, whatever the timeline says.
 */
export const FIRST_PAINT_WAIT_MS = 1000;

const paintTimed = () =>
  typeof PerformanceObserver === "function" &&
  PerformanceObserver.supportedEntryTypes.includes("paint");

/**
 * Runs `run` once the page's first contentful paint is on screen, as the
 * browser's own paint timing records it. It is checked on each animation
 * frame (so a hidden page waits until it shows); where the browser keeps no
 * paint timing, or records none within FIRST_PAINT_WAIT_MS, it runs after
 * the next painted frame. Returns a function that cancels the run.
 */
export function afterFirstPaint(run: () => void): () => void {
  const timed = paintTimed();
  let start: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  const check = (now: number) => {
    start ??= now;
    const painted =
      !timed ||
      performance.getEntriesByName(FIRST_CONTENTFUL_PAINT).length > 0 ||
      now - start >= FIRST_PAINT_WAIT_MS;
    // A task after the frame, so the run never delays the frame itself.
    if (painted) timer = setTimeout(run, 0);
    else frame = requestAnimationFrame(check);
  };
  frame = requestAnimationFrame(check);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}
