// The child processes a host started and has not seen end, so closing it
// can stop them. Each host has its own registry (realAdapters); `shared` is
// the default for a call made outside a host, as the tests make.
export function createChildren() {
  const running = new Set();
  return {
    // Keeps `child` until it exits or fails to start (which emits no
    // 'exit'), and hands it back.
    track(child) {
      running.add(child);
      const drop = () => running.delete(child);
      child.once("exit", drop);
      child.once("error", drop);
      return child;
    },
    stop() {
      for (const child of running) child.kill();
      running.clear();
    },
    // How many are still running, for the tests.
    size: () => running.size,
  };
}

export const shared = createChildren();
