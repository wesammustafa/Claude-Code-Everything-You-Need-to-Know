// The app's connection, faked in the browser: the built client is served by
// `vite preview`, which has no /api. Every page gets an EventSource the test
// drives through `window.__questStream`, and a health answer. By default each
// stream answers with a snapshot at once, so a page is connected as it opens:
// the typed b-1 snapshot (snapshots.ts) whose phase the opened route shows,
// the workspace watching its step on a step route, Lesson complete's on a complete route,
// the whole course with b-4 open on its overview on the Learning journey and
// Progress (with three skills' Mastery there), and
// the overview's elsewhere, sent again whenever the route changes. A test that
// sets `manualStream` sends every frame itself; one that sets
// `shownMilestones` gets a fake server that remembers milestone.shown (249). Actions get an answer that
// changes nothing, but for hint.next, which opens the step's first hint. The real server's stream is b1-slice.spec.ts's and 222's.
import { test as base, expect, type Page } from "@playwright/test";
import {
  beginnerDone,
  complete,
  completeCapstone,
  courseDone,
  fullCourse,
  hinted,
  overview,
  overviewAt,
  snapshotOf,
  someMastery,
  watching,
} from "./snapshots.ts";

export { expect };

export const INSTANCE = "e2e";

/** The first snapshot by route: the phase whose screen the route shows. */
export interface RoutedSnapshots {
  step: unknown;
  complete: unknown;
  journey: unknown;
  progress: unknown;
  /** A Level moment's route and the course moment's (249). */
  level: unknown;
  course: unknown;
  other: unknown;
}

const ROUTED: RoutedSnapshots = {
  step: snapshotOf(watching),
  complete: snapshotOf(complete),
  // Every Level and Lesson, three done (243). The other routes keep b-1's
  // place, which the Lesson specs read.
  journey: snapshotOf(overviewAt("b-4"), {
    welcomed: true,
    course: fullCourse,
  }),
  // The same place, with three skills' Mastery (250).
  progress: snapshotOf(overviewAt("b-4"), {
    welcomed: true,
    course: fullCourse,
    mastery: someMastery,
  }),
  // The Beginner capstone complete, and with it the Level (249).
  level: snapshotOf(completeCapstone, { course: beginnerDone }),
  course: snapshotOf(complete, { course: courseDone }),
  // Welcomed, so Welcome's Start goes straight to the Lesson's route.
  other: snapshotOf(overview, { welcomed: true }),
};

/** The routed snapshot a hash shows, as the page's fake stream picks it. */
function routedFor(hash: string, routed: RoutedSnapshots): unknown {
  if (/^#\/lesson\/[^/]+\/step\/?$/.test(hash)) return routed.step;
  if (/^#\/lesson\/[^/]+\/complete\/?$/.test(hash)) return routed.complete;
  if (/^#\/journey\/?$/.test(hash)) return routed.journey;
  if (/^#\/progress\/?$/.test(hash)) return routed.progress;
  if (/^#\/level\/[^/]+\/complete\/?$/.test(hash)) return routed.level;
  if (/^#\/course\/complete\/?$/.test(hash)) return routed.course;
  return routed.other;
}

/** The snapshot without the milestones already shown. */
function withoutShown(data: unknown, shown: ReadonlySet<string>): unknown {
  const body = data as { milestones?: { id: string }[] };
  return {
    ...body,
    milestones: (body.milestones ?? []).filter((m) => !shown.has(m.id)),
  };
}

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
  shownIds,
}: {
  manual: boolean;
  routed: RoutedSnapshots;
  /** The milestones the fake server was told were shown, left out of each snapshot. */
  shownIds: boolean;
}) {
  // Each one a revision higher, so the page applies it.
  let revision = 0;
  const pick = (): unknown =>
    /^#\/lesson\/[^/]+\/step\/?$/.test(location.hash)
      ? routed.step
      : /^#\/lesson\/[^/]+\/complete\/?$/.test(location.hash)
        ? routed.complete
        : /^#\/journey\/?$/.test(location.hash)
          ? routed.journey
          : /^#\/progress\/?$/.test(location.hash)
            ? routed.progress
            : /^#\/level\/[^/]+\/complete\/?$/.test(location.hash)
              ? routed.level
              : /^#\/course\/complete\/?$/.test(location.hash)
                ? routed.course
                : routed.other;
  const first = (): unknown => {
    revision += 1;
    return { ...(pick() as object), revision };
  };
  const filtered = async (): Promise<unknown> => {
    const data = pick() as { milestones?: { id: string }[] };
    revision += 1;
    const shown = new Set(
      await (
        window as unknown as { __questShownIds: () => Promise<string[]> }
      ).__questShownIds(),
    );
    return {
      ...data,
      revision,
      milestones: (data.milestones ?? []).filter((m) => !shown.has(m.id)),
    };
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
        else if (manual) return;
        else if (!shownIds) this.frame("snapshot", first());
        else
          void filtered().then((data) => {
            this.frame("snapshot", data);
          });
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
      // Only a Lesson's route has a place to move to, and the journey and
      // Progress their whole course.
      if (
        location.hash.startsWith("#/lesson/") ||
        /^#\/(journey|progress|course\/complete)\/?$/.test(location.hash) ||
        /^#\/level\/[^/]+\/complete\/?$/.test(location.hash)
      ) {
        const source = open();
        if (!shownIds) source?.frame("snapshot", first());
        else void filtered().then((data) => source?.frame("snapshot", data));
      }
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
export const test = base.extend<{
  manualStream: boolean;
  /** Snapshots that replace the routed ones (249). */
  routedSnapshots: Partial<RoutedSnapshots>;
  /**
   * The fake server keeps the milestones each milestone.shown names, for
   * every page of the context: it answers with the routed snapshot without
   * them, a revision higher, and every later stream leaves them out (249).
   */
  shownMilestones: boolean;
}>({
  manualStream: [false, { option: true }],
  routedSnapshots: [{}, { option: true }],
  shownMilestones: [false, { option: true }],
  context: async (
    { context, manualStream, routedSnapshots, shownMilestones },
    provide,
  ) => {
    const routed = { ...ROUTED, ...routedSnapshots };
    const shown = new Set<string>();
    if (shownMilestones)
      await context.exposeFunction("__questShownIds", () => [...shown]);
    await context.addInitScript(installFakeStream, {
      manual: manualStream,
      routed,
      shownIds: shownMilestones,
    });
    await context.route("**/api/health", (route) =>
      route.fulfill({ json: { ok: true, instance: INSTANCE } }),
    );
    await context.route("**/api/actions", (route) => {
      const { action, revision } = route.request().postDataJSON() as {
        action: { type: string; id?: string };
        revision: number;
      };
      if (shownMilestones && action.type === "milestone.shown") {
        shown.add(action.id ?? "");
        const hash = new URL(route.request().frame().url()).hash;
        const answer = {
          ...(withoutShown(routedFor(hash, routed), shown) as object),
          revision: revision + 1,
        };
        return route.fulfill({
          json: { revision: revision + 1, snapshot: answer },
        });
      }
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
