// The child processes a host started and has not seen end, so closing it
// can stop them. Each host has its own registry (realAdapters); `shared` is
// the default for a call made outside a host, as the tests make.
import type { ChildProcess } from "node:child_process";

export interface Children {
  track: <C extends ChildProcess>(child: C, kill?: () => void) => C;
  stop: () => void;
  size: () => number;
}

export function createChildren(): Children {
  const running = new Map<ChildProcess, () => void>();
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
