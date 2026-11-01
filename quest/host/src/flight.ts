// Runs that wait in line, and one Check child at a time
// (guards.9-single-flight).

// One run at a time; a request during a run schedules exactly one more.
export function singleFlight<A extends unknown[], R>(
  fn: (...args: A) => R | Promise<R>,
): (...args: A) => Promise<R> {
  let running: Promise<R> | null = null;
  let again: A | null = null;
  const go = (...args: A): Promise<R> => {
    if (running) {
      again = args;
      return running;
    }
    running = Promise.resolve(fn(...args)).finally(() => {
      running = null;
      if (again) {
        const next = again;
        again = null;
        void go(...next);
      }
    });
    return running;
  };
  return go;
}

// A run asked for during another waits in line, and a later ask takes its
// place (singleFlight). What r asked for stays owed until a run starts:
// its slow items, and `asked`, the latest r's number, which goes back on
// the result so the card knows that r's run ended. Only while the ask that
// takes its place is for the same lesson (the first argument): another
// lesson's run is not r's, and r's run will not come.
//
// With `covers`, an r (an ask with a number) that the running run already
// answers joins it instead: nothing waits in line, the running run carries
// the later number, and the ask gets its promise. `covers(args, flags, ask,
// { slow })` sees the running run's arguments and flags, and the ask's. So
// `fn` takes its number with `flags.report()` when it reports, not when it
// starts, and an ask after that waits in line: the run has answered, even
// before it ends. A poll never joins: what changed since the run started
// may need another.
// What a run of `owing` is given: what was owed when it started, and how to
// take its number when it reports.
export interface Flags {
  slow: boolean;
  asked: number;
  lesson: unknown;
  report: () => number;
}

interface Owed {
  slow: boolean;
  asked: number;
  lesson: unknown;
}

// The run under way: its arguments, its flags, and its promise.
interface Run<A extends unknown[], R> {
  args: A;
  flags: Flags;
  promise: Promise<R>;
}

export interface Ask {
  slow?: boolean | undefined;
  asked?: number | undefined;
}

export function owing<A extends unknown[], R>(
  fn: (flags: Flags, ...args: A) => R | Promise<R>,
  {
    covers,
  }: {
    covers?: (
      args: A,
      flags: Flags,
      ask: A,
      opts: { slow: boolean },
    ) => boolean;
  } = {},
): (ask?: Ask, ...args: A) => Promise<R> {
  const none: Owed = { slow: false, asked: 0, lesson: undefined };
  let owed = none;
  // The run under way, from its start until it reports or ends: waiting in
  // the lane (oneAtATime) counts.
  let current: Run<A, R> | null = null;
  const go = singleFlight((...args: A) => {
    const flags = { ...owed } as Flags;
    owed = none;
    const run = { args, flags } as Run<A, R>;
    flags.report = () => {
      if (current === run) current = null;
      return flags.asked;
    };
    current = run;
    run.promise = Promise.resolve(fn(flags, ...args)).finally(() => {
      if (current === run) current = null;
    });
    return run.promise;
  });
  return ({ slow, asked }: Ask = {}, ...args: A) => {
    if (
      covers &&
      current &&
      asked !== undefined &&
      asked > 0 &&
      covers(current.args, current.flags, args, { slow: Boolean(slow) })
    ) {
      current.flags.asked = Math.max(current.flags.asked, asked);
      return current.promise;
    }
    const was = owed.lesson === args[0] ? owed : none;
    owed = {
      slow: was.slow || Boolean(slow),
      asked: Math.max(was.asked, asked ?? 0),
      lesson: args[0],
    };
    return go(...args);
  };
}

// One at a time, in the order asked, across every kind of run that starts
// a Check child: each `fn` starts when the one before it has ended, however
// it ended, and at once when none is running or waiting, so an idle lane
// starts a child as soon as it is asked for.
export function oneAtATime(): <R>(fn: () => R | Promise<R>) => Promise<R> {
  // The last run's end, until it has ended with nothing after it.
  let last: Promise<void> | null = null;
  return <R>(fn: () => R | Promise<R>): Promise<R> => {
    const run: Promise<R> = last
      ? last.then(() => fn())
      : new Promise<R>((resolve) => {
          resolve(fn());
        });
    const ended = run.then(
      () => {},
      () => {},
    );
    last = ended;
    void ended.then(() => {
      if (last === ended) last = null;
    });
    return run;
  };
}
