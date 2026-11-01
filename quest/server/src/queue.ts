// Actions run one at a time, in arrival order, with at most `limit` waiting
// behind the one running (spec, Server security: 20). One more is refused,
// for a 429.

export interface Queue {
  /** Runs `task` after those before it, or returns null when the queue is full. */
  run<T>(task: () => Promise<T>): Promise<T> | null;
  /** The tasks running or waiting. */
  size(): number;
}

export function createQueue(limit = 20): Queue {
  let tail: Promise<unknown> = Promise.resolve();
  let held = 0;
  return {
    run(task) {
      // One running and `limit` waiting.
      if (held > limit) return null;
      held++;
      const result = tail.then(task).finally(() => {
        held--;
      });
      // A failed task never stops the ones after it.
      tail = result.catch(() => undefined);
      return result;
    },
    size: () => held,
  };
}
