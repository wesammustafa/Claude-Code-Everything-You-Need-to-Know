// A page connected to a fake server, for the screens' tests: the shell's
// own LiveProvider on a fake EventSource, the snapshot the test sends, and a
// fetch that records each action and answers it as the test says.
import { act, render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { onTestFinished, vi } from "vitest";
import type { QuestAction, Snapshot } from "@quest/contract";
import { resetPageCache } from "../src/pages/fetch";
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
  /** Every GET under /pages/, oldest first. */
  pageFetches: string[];
}

/** The rendered pages the fake server holds: an index and its pages. */
export const PAGE_INDEX = {
  ref: "v0000.00",
  pages: [
    {
      path: "docs/beginner/01-install-and-look-around.md",
      url: "/pages/beginner/01-install-and-look-around.html",
      title: "Install, sign in and look around",
      kind: "lesson",
      level: "beginner",
    },
    {
      path: "docs/reference/commands.md",
      url: "/pages/reference/commands.html",
      title: "Commands by level",
      kind: "reference",
    },
    {
      path: "docs/beginner/electives/notes.md",
      url: "/pages/beginner/electives/notes.html",
      title: "Keep notes with Claude",
      kind: "elective",
      level: "beginner",
    },
  ],
};

const PAGES: Record<string, string> = {
  "/pages/index.json": JSON.stringify(PAGE_INDEX),
  "/pages/beginner/01-install-and-look-around.html":
    '<h1 id="install">Install, sign in and look around</h1><p>The lesson.</p>',
  "/pages/reference/commands.html":
    '<h1 id="commands">Commands by level</h1><p>Every command.</p>',
  "/pages/beginner/electives/notes.html":
    '<h1 id="notes">Keep notes with Claude</h1><p>An elective.</p>',
};

/** Renders the app at `path`, connected with `snapshot` (unless null). */
export function renderConnected(
  path: string,
  snapshot: Snapshot | null,
): Connected {
  FakeEventSource.reset();
  resetPageCache();
  vi.stubGlobal("EventSource", FakeEventSource);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  const posts: QuestAction[] = [];
  const pageFetches: string[] = [];
  let shown = snapshot;
  let next: Snapshot | null = null;
  let gate: Promise<void> | null = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/health")
        return Response.json({ ok: true, instance: shown?.instance ?? "t" });
      if (url.startsWith("/pages/")) {
        pageFetches.push(url);
        const page = PAGES[url];
        return page === undefined
          ? new Response("", { status: 404 })
          : new Response(page);
      }
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
    pageFetches,
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
