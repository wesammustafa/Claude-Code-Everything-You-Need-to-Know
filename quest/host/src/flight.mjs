// Runs that wait in line (guards.9-single-flight).

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
export function owing(fn) {
  const none = { slow: false, asked: 0, lesson: undefined };
  let owed = none;
  const go = singleFlight((...args) => {
    const flags = owed;
    owed = none;
    return fn(flags, ...args);
  });
  return ({ slow, asked } = {}, ...args) => {
    const was = owed.lesson === args[0] ? owed : none;
    owed = {
      slow: was.slow || Boolean(slow),
      asked: Math.max(was.asked, asked ?? 0),
      lesson: args[0],
    };
    return go(...args);
  };
}
