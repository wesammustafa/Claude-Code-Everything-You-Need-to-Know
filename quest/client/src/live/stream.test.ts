import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FakeEventSource } from "../../test/live";
import {
  BACKOFF_MAX_MS,
  BACKOFF_MIN_MS,
  HIDE_KEEP_MS,
  SILENCE_MS,
  openStream,
  type StreamHandlers,
} from "./stream";

let hidden = false;
let changed: () => void = () => undefined;

function open(after: () => string | null = () => null) {
  const frames: [string, unknown, string][] = [];
  const failed = vi.fn();
  const parked = vi.fn();
  const handlers: StreamHandlers = {
    after,
    frame: (name, data, id) => frames.push([name, data, id]),
    failed,
    parked,
  };
  const stream = openStream(
    {
      EventSource: FakeEventSource,
      setTimeout: (run, ms) => setTimeout(run, ms),
      clearTimeout: (handle) => {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      },
      hidden: () => hidden,
      onVisibility: (listener) => {
        changed = listener;
        return () => {
          changed = () => undefined;
        };
      },
    },
    handlers,
  );
  return { stream, frames, failed, parked };
}

/** Lets `ms` pass with a heartbeat every 15 seconds, as the server sends. */
function beating(ms: number) {
  for (let left = ms; left > 0; left -= 15_000) {
    vi.advanceTimersByTime(Math.min(left, 15_000));
    FakeEventSource.last.emit("heartbeat", {});
  }
}

const setHidden = (value: boolean) => {
  hidden = value;
  changed();
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.reset();
  hidden = false;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the event stream", () => {
  test("opens /api/events and passes on each frame, parsed", () => {
    const { frames } = open();
    expect(FakeEventSource.last.url).toBe("/api/events");
    FakeEventSource.last.emit("snapshot", { revision: 1 });
    FakeEventSource.last.emit("event", { id: "i.1" }, "i.1");
    expect(frames).toEqual([
      ["snapshot", { revision: 1 }, ""],
      ["event", { id: "i.1" }, "i.1"],
    ]);
  });

  test("reconnects itself after a failure, with ?after= the last ID held", () => {
    const { failed } = open(() => "i/7 8");
    FakeEventSource.last.fail();
    expect(failed).toHaveBeenCalledOnce();
    expect(FakeEventSource.made[0]?.closed).toBe(true);
    vi.advanceTimersByTime(BACKOFF_MIN_MS);
    expect(FakeEventSource.made).toHaveLength(2);
    expect(FakeEventSource.last.url).toBe("/api/events?after=i%2F7%208");
  });

  test("backs off 1, 2, 4, 5 and 5 seconds, and starts again at 1 after a snapshot", () => {
    open();
    const waits: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      FakeEventSource.last.fail();
      const before = FakeEventSource.made.length;
      let waited = 0;
      while (FakeEventSource.made.length === before) {
        vi.advanceTimersByTime(500);
        waited += 500;
      }
      waits.push(waited);
    }
    expect(waits).toEqual([1000, 2000, 4000, BACKOFF_MAX_MS, BACKOFF_MAX_MS]);

    // An open stream with no snapshot yet keeps the backoff.
    FakeEventSource.last.emit("heartbeat", {});
    FakeEventSource.last.fail();
    vi.advanceTimersByTime(BACKOFF_MAX_MS - 1);
    const count = FakeEventSource.made.length;
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.made).toHaveLength(count + 1);

    FakeEventSource.last.emit("snapshot", {});
    FakeEventSource.last.fail();
    vi.advanceTimersByTime(BACKOFF_MIN_MS);
    expect(FakeEventSource.made).toHaveLength(count + 2);
  });

  test("40 seconds of silence closes the stream and reconnects; any frame re-arms it", () => {
    const { failed } = open();
    vi.advanceTimersByTime(SILENCE_MS - 1);
    FakeEventSource.last.emit("heartbeat", {});
    vi.advanceTimersByTime(SILENCE_MS - 1);
    expect(failed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(failed).toHaveBeenCalledOnce();
    expect(FakeEventSource.made[0]?.closed).toBe(true);
    vi.advanceTimersByTime(BACKOFF_MIN_MS);
    expect(FakeEventSource.made).toHaveLength(2);
  });

  test("hidden for 2 minutes, it closes quietly, and reopens at once with ?after= when visible", () => {
    let last: string | null = null;
    const { failed, parked } = open(() => last);
    FakeEventSource.last.emit("event", {}, "i.3");
    last = "i.3";
    setHidden(true);
    beating(HIDE_KEEP_MS - 1);
    expect(FakeEventSource.last.closed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.last.closed).toBe(true);
    expect(parked).toHaveBeenCalledOnce();
    // No failure: no notice, no reconnect, no silence while closed.
    vi.advanceTimersByTime(SILENCE_MS * 2);
    expect(failed).not.toHaveBeenCalled();
    expect(FakeEventSource.made).toHaveLength(1);

    setHidden(false);
    expect(FakeEventSource.made).toHaveLength(2);
    expect(FakeEventSource.last.url).toBe("/api/events?after=i.3");
  });

  test("hidden for less than 2 minutes, it stays open", () => {
    open();
    setHidden(true);
    beating(HIDE_KEEP_MS - 1);
    setHidden(false);
    beating(HIDE_KEEP_MS);
    expect(FakeEventSource.made).toHaveLength(1);
    expect(FakeEventSource.last.closed).toBe(false);
  });

  test("a closed page's pending reconnect is dropped when it hides for good", () => {
    open();
    setHidden(true);
    FakeEventSource.last.fail();
    vi.advanceTimersByTime(HIDE_KEEP_MS);
    const count = FakeEventSource.made.length;
    vi.advanceTimersByTime(SILENCE_MS * 4);
    expect(FakeEventSource.made).toHaveLength(count);
  });

  test("a frame that is not JSON is dropped, and still counts against the silence", () => {
    const { frames, failed } = open();
    vi.advanceTimersByTime(SILENCE_MS - 1);
    FakeEventSource.last.emitRaw("snapshot", "{");
    vi.advanceTimersByTime(SILENCE_MS - 1);
    expect(frames).toEqual([]);
    expect(failed).not.toHaveBeenCalled();
  });

  test("closing stops everything", () => {
    const { stream, failed } = open();
    stream.close();
    expect(FakeEventSource.last.closed).toBe(true);
    vi.advanceTimersByTime(SILENCE_MS * 2);
    expect(failed).not.toHaveBeenCalled();
    expect(FakeEventSource.made).toHaveLength(1);
  });
});
