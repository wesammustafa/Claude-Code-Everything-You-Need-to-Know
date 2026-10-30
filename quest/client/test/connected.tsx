// A page connected to a fake server, for the screens' tests: the shell's
// own LiveProvider on a fake EventSource, the snapshot the test sends, and a
// fetch that records each action and answers it as the test says.
import { act, render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { onTestFinished, vi } from "vitest";
import type { QuestAction, Snapshot } from "@quest/contract";
import { routes } from "../src/routes";
import { FakeEventSource } from "./live";

export interface Connected {
  router: ReturnType<typeof createMemoryRouter>;
  /** Every action POSTed, oldest first. */
  posts: QuestAction[];
  /** Sends a snapshot on the stream. */
  send: (snapshot: Snapshot) => void;
  /**
   * The next answers wait until `release()`; each then answers 200 with
   * the snapshot the test gives `answer`, or the one on screen.
   */
  hold: () => { release: () => Promise<void> };
  /** The snapshot the next answers carry. */
  answer: (snapshot: Snapshot) => void;
}

/** Renders the app at `path`, connected with `snapshot` (unless null). */
export function renderConnected(
  path: string,
  snapshot: Snapshot | null,
): Connected {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  const posts: QuestAction[] = [];
  let shown = snapshot;
  let next: Snapshot | null = null;
  let gate: Promise<void> | null = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/health")
        return Response.json({ ok: true, instance: shown?.instance ?? "t" });
      const body = JSON.parse(init?.body as string) as { action: QuestAction };
      posts.push(body.action);
      if (gate) await gate;
      const reply = next ?? shown;
      return Response.json({ revision: reply?.revision, snapshot: reply });
    }),
  );
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  const send = (data: Snapshot) => {
    shown = data;
    act(() => {
      FakeEventSource.last.emit("snapshot", data);
    });
  };
  if (snapshot) send(snapshot);
  return {
    router,
    posts,
    send,
    hold() {
      const { promise, resolve } = Promise.withResolvers<undefined>();
      gate = promise;
      return {
        release: async () => {
          gate = null;
          await act(async () => {
            resolve(undefined);
            await promise;
          });
        },
      };
    },
    answer(data) {
      next = data;
    },
  };
}
