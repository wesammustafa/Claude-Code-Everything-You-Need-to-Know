// Runs that wait in line, and one Check child at a time
// (guards.9-single-flight).

// One run at a time; a request during a run schedules exactly one more.
export function singleFlight(fn) {
  let running = null;
  let again = null;
  const go = (...args) => {
    if (running) {
      again = args;
      return running;
    }
    running = Promise.resolve(fn(...args)).finally(() => {
      running = null;
      if (again) {
        const next = again;
        again = null;
        go(...next);
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
export function owing(fn, { covers } = {}) {
  const none = { slow: false, asked: 0, lesson: undefined };
  let owed = none;
  // The run under way, from its start until it reports or ends: waiting in
  // the lane (oneAtATime) counts.
  let current = null;
  const go = singleFlight((...args) => {
    const flags = { ...owed };
    owed = none;
    const run = { args, flags };
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
  return ({ slow, asked } = {}, ...args) => {
    if (
      covers &&
      current &&
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
export function oneAtATime() {
  // The last run's end, until it has ended with nothing after it.
  let last = null;
  return (fn) => {
    const run = last
      ? last.then(() => fn())
      : new Promise((resolve) => resolve(fn()));
    const ended = run.then(
      () => {},
      () => {},
    );
    last = ended;
    ended.then(() => {
      if (last === ended) last = null;
    });
    return run;
  };
}
