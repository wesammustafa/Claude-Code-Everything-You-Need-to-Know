// The child processes a host started and has not seen end, so closing it
// can stop them. Each host has its own registry (realAdapters); `shared` is
// the default for a call made outside a host, as the tests make.
export function createChildren() {
  const running = new Map();
  return {
    // Keeps `child` until it exits or fails to start (which emits no
    // 'exit'), with how to end it, and hands it back. The Check child's
    // runner passes one that ends its process group too.
    track(child, kill = () => child.kill()) {
      running.set(child, kill);
      const drop = () => running.delete(child);
      child.once("exit", drop);
      child.once("error", drop);
      return child;
    },
    stop() {
      for (const kill of running.values()) kill();
      running.clear();
    },
    // How many are still running, for the tests.
    size: () => running.size,
  };
}

export const shared = createChildren();
