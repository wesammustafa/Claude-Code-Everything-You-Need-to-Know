// The app's connection, faked in the browser: the built client is served by
// `vite preview`, which has no /api. Every page gets an EventSource the test
// drives through `window.__questStream`, and a health answer. By default each
// stream answers with a snapshot at once, so a page is connected as it opens;
// a test that sets `manualStream` sends every frame itself. The real server's
// stream is 222's end-to-end test.
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

export const INSTANCE = "e2e";

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
  first,
}: {
  manual: boolean;
  first: unknown;
}) {
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
        else if (!manual) this.frame("snapshot", first);
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
      first: snapshot(),
    });
    await context.route("**/api/health", (route) =>
      route.fulfill({ json: { ok: true, instance: INSTANCE } }),
    );
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
