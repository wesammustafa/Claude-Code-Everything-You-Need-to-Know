// The app's connection, faked in the browser: the built client is served by
// `vite preview`, which has no /api. Every page gets an EventSource the test
// drives through `window.__questStream`, and a health answer. By default each
// stream answers with a snapshot at once, so a page is connected as it opens:
// the typed b-1 snapshot (snapshots.ts) whose phase the opened route shows,
// the workspace watching its step on a step route, Lesson complete's on a complete route and
// the overview's elsewhere, sent again whenever the route changes. A test that
// sets `manualStream` sends every frame itself. Actions get an answer that
// changes nothing, but for hint.next, which opens the step's first hint. The real server's stream is b1-slice.spec.ts's and 222's.
import { test as base, expect, type Page } from "@playwright/test";
import {
  complete,
  hinted,
  overview,
  snapshotOf,
  watching,
} from "./snapshots.ts";

export { expect };

export const INSTANCE = "e2e";

/** The first snapshot by route: the phase whose screen the route shows. */
export interface RoutedSnapshots {
  step: unknown;
  complete: unknown;
  other: unknown;
}

const ROUTED: RoutedSnapshots = {
  step: snapshotOf(watching),
  complete: snapshotOf(complete),
  // Welcomed, so Welcome's Start goes straight to the Lesson's route.
  other: snapshotOf(overview, { welcomed: true }),
};

/** A snapshot with only what the connection layer reads. */
export const snapshot = (revision = 1, milestones: unknown[] = []) => ({
  instance: INSTANCE,
  revision,
  milestones,
});

/** What the page's fake stream offers the test. */
export interface QuestStream {
  /** Every stream's URL, oldest first. */
  urls: string[];
  /** A stream is open. */
  open: boolean;
  snapshot(data: unknown): void;
  event(envelope: { id: string; [field: string]: unknown }): void;
  heartbeat(data: unknown): void;
  /** The open stream fails. */
  fail(): void;
  /** While down, every stream fails as it opens. */
  down(on: boolean): void;
}

declare global {
  interface Window {
    __questStream: QuestStream;
  }
}

/** Runs in the page before its own script: replaces EventSource. */
function installFakeStream({
  manual,
  routed,
}: {
  manual: boolean;
  routed: RoutedSnapshots;
}) {
  // Each one a revision higher, so the page applies it.
  let revision = 0;
  const first = (): unknown => {
    const data = /^#\/lesson\/[^/]+\/step\/?$/.test(location.hash)
      ? routed.step
      : /^#\/lesson\/[^/]+\/complete\/?$/.test(location.hash)
        ? routed.complete
        : routed.other;
    revision += 1;
    return { ...(data as object), revision };
  };
  const sources: FakeEventSource[] = [];
  let down = false;
  class FakeEventSource extends EventTarget {
    readonly url: string;
    closed = false;
    constructor(url: string | URL) {
      super();
      this.url = String(url);
      sources.push(this);
      queueMicrotask(() => {
        if (down) this.dispatchEvent(new Event("error"));
        else if (!manual) this.frame("snapshot", first());
      });
    }
    frame(name: string, data: unknown, id = "") {
      if (this.closed) return;
      this.dispatchEvent(
        new MessageEvent(name, { data: JSON.stringify(data), lastEventId: id }),
      );
    }
    close() {
      this.closed = true;
    }
  }
  const open = () => sources.filter((source) => !source.closed).at(-1);
  Object.assign(window, { EventSource: FakeEventSource });
  // A test that goes to another route (page.goto with a new hash, no reload)
  // finds the place there: the fake server moves with it. On popstate, and
  // this listener before the router's, so the shell's route-follows-place
  // rule already lands on the new hash.
  if (!manual)
    window.addEventListener("popstate", () => {
      // Only a Lesson's route has a place to move to.
      if (location.hash.startsWith("#/lesson/"))
        open()?.frame("snapshot", first());
    });
  const stream: QuestStream = {
    get urls() {
      return sources.map((source) => source.url);
    },
    get open() {
      return open() !== undefined;
    },
    snapshot: (data) => open()?.frame("snapshot", data),
    event: (envelope) => open()?.frame("event", envelope, envelope.id),
    heartbeat: (data) => open()?.frame("heartbeat", data),
    fail: () => open()?.dispatchEvent(new Event("error")),
    down: (on) => {
      down = on;
    },
  };
  window.__questStream = stream;
}

/** Playwright's test, with every page's connection faked. */
export const test = base.extend<{ manualStream: boolean }>({
  manualStream: [false, { option: true }],
  context: async ({ context, manualStream }, provide) => {
    await context.addInitScript(installFakeStream, {
      manual: manualStream,
      routed: ROUTED,
    });
    await context.route("**/api/health", (route) =>
      route.fulfill({ json: { ok: true, instance: INSTANCE } }),
    );
    await context.route("**/api/actions", (route) => {
      const { action, revision } = route.request().postDataJSON() as {
        action: { type: string };
        revision: number;
      };
      // The same revision is never applied; a higher one is.
      const answer =
        action.type === "hint.next"
          ? snapshotOf(hinted, { revision: revision + 1 })
          : snapshotOf(watching, { revision });
      return route.fulfill({
        json: { revision: answer.revision, snapshot: answer },
      });
    });
    await provide(context);
  },
});

/** Waits for the page's stream, then connects it with a snapshot. */
export async function connected(page: Page, data: unknown = snapshot()) {
  await page.waitForFunction(() => window.__questStream.open);
  await page.evaluate((frame) => {
    window.__questStream.snapshot(frame);
  }, data);
}

/** One revision's events, on the page's stream. */
export async function sendEvents(
  page: Page,
  events: readonly { id: string; [field: string]: unknown }[],
) {
  await page.waitForFunction(() => window.__questStream.open);
  await page.evaluate((batch) => {
    for (const event of batch) window.__questStream.event(event);
  }, events);
}
