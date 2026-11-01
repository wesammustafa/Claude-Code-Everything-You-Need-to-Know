// GET /api/events: the opening snapshot, replay, ordering, coalescing, the
// heartbeat and the 8-stream cap, through the app around a real host on fake
// adapters. The host's fake clock drives every timer: no test sleeps.
import { afterEach, describe, expect, test } from "vitest";
import type { EventEnvelope, Snapshot } from "@quest/contract";
import { EVENT_KEEP_MS } from "@quest/host";
import { createApp } from "../src/app.ts";
import {
  COALESCE_MS,
  HEARTBEAT_MS,
  MAX_BACKLOG,
  MAX_STREAMS,
  RETRY_MS,
  createStreams,
} from "../src/events.ts";
import { SECURITY_HEADERS } from "../src/headers.ts";
import {
  INSTANCE,
  actionKit,
  at,
  questHost,
  type ActionKit,
} from "./action-kit.ts";
import { openStream, streamHeaders, type Frame, type Reader } from "./sse.ts";

const readers: Reader[] = [];
const kits: ActionKit[] = [];
afterEach(async () => {
  for (const reader of readers.splice(0)) await reader.close();
  for (const kit of kits.splice(0)) {
    kit.streams.closeAll();
    kit.host.close();
  }
});

async function kitFor(options: Parameters<typeof actionKit>[0] = {}) {
  const kit = await actionKit(options);
  kits.push(kit);
  return kit;
}

async function open(
  kit: ActionKit,
  options: Parameters<typeof openStream>[1] = {},
) {
  const reader = await openStream(kit.app, options);
  readers.push(reader);
  return reader;
}

const snap = (frame: Frame) => frame.data as Snapshot;

// Welcome, then start b-1 (no events), then mark its first step done: one
// event, `${INSTANCE}.1`, at the returned revision.
async function toFirstEvent(kit: ActionKit) {
  for (const action of [
    { type: "welcome.finish" },
    { type: "lesson.open", lesson: "b-1" },
    { type: "lesson.start", help: "planned" },
  ])
    expect((await kit.post(at(kit.host, action))).status).toBe(200);
  expect((await kit.post(at(kit.host, { type: "step.markDone" }))).status).toBe(
    200,
  );
  return kit.host.revision();
}

// Two events this instance holds: `${INSTANCE}.1` and `${INSTANCE}.2`.
async function twoEvents(kit: ActionKit) {
  await toFirstEvent(kit);
  for (const action of [
    { type: "step.continue" },
    { type: "answer.pick", option: 0 },
  ])
    await kit.post(at(kit.host, action));
  expect(kit.host.eventsAfter(`${INSTANCE}.1`)?.map((e) => e.id)).toEqual([
    `${INSTANCE}.2`,
  ]);
}

describe("the registry", () => {
  test("holds each stream until its removal", () => {
    const streams = createStreams();
    const remove = streams.add(() => undefined);
    streams.add(() => undefined);
    expect(streams.size()).toBe(2);
    remove();
    expect(streams.size()).toBe(1);
  });

  test("a ninth closes the oldest, first", () => {
    const streams = createStreams();
    const closed: number[] = [];
    for (let i = 0; i < MAX_STREAMS; i++) streams.add(() => closed.push(i));
    expect(closed).toEqual([]);
    streams.add(() => closed.push(8));
    expect(closed).toEqual([0]);
    expect(streams.size()).toBe(MAX_STREAMS);
  });

  test("closeAll closes every one", () => {
    const streams = createStreams({ limit: 3 });
    const closed: number[] = [];
    for (let i = 0; i < 3; i++) streams.add(() => closed.push(i));
    streams.closeAll();
    expect(closed).toEqual([0, 1, 2]);
    expect(streams.size()).toBe(0);
  });
});

describe("opening", () => {
  test("is an SSE response with no-store and the security headers", async () => {
    const reader = await open(await kitFor());
    const { headers } = reader.response;
    expect(reader.response.status).toBe(200);
    expect(headers.get("Content-Type")).toContain("text/event-stream");
    expect(headers.get("Cache-Control")).toBe("no-store");
    expect(headers.get("Access-Control-Allow-Origin")).toBeNull();
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      expect(headers.get(name)).toBe(value);
  });

  test("the first frame is the snapshot with retry and no id; no later frame has retry", async () => {
    const kit = await kitFor();
    const reader = await open(kit);
    const first = await reader.next();
    expect(first.event).toBe("snapshot");
    expect(first.retry).toBe(RETRY_MS);
    expect(first.id).toBeUndefined();
    expect(snap(first)).toEqual(kit.host.snapshot());
    await kit.post(at(kit.host, { type: "welcome.finish" }));
    await kit.clock.advance(HEARTBEAT_MS);
    const later = await reader.frames(2);
    expect(later.map((f) => f.event)).toEqual(["snapshot", "heartbeat"]);
    expect(later.every((f) => f.retry === undefined)).toBe(true);
  });

  test("carries the unreadable notice as a pending milestone", async () => {
    const kit = await kitFor({ saved: { unreadable: "moved" } });
    const first = snap(await (await open(kit)).next());
    expect(first.revision).toBe(2);
    const [notice] = first.milestones;
    expect(notice?.type === "notice" && notice.kind).toBe("unreadable");
  });

  test("an app without a host answers 404", async () => {
    const app = createApp({
      health: () => ({ ok: true, instance: "i-1" }),
      statics: new Map(),
      log: () => undefined,
    });
    const response = await app.request("/api/events", {
      headers: streamHeaders(),
    });
    expect(response.status).toBe(404);
  });

  test("a host whose open() failed answers 503 starting", async () => {
    const ready = Promise.reject(new Error("no git"));
    const kit = await kitFor({ host: questHost(), open: false, ready });
    const reader = await open(kit);
    expect(reader.response.status).toBe(503);
    expect(reader.response.headers.get("Retry-After")).toBe("1");
    expect(reader.response.headers.get("Cache-Control")).toBe("no-store");
  });

  test.each(["cross-site", "same-site", "none"])(
    "Sec-Fetch-Site: %s is refused with no stream",
    async (site) => {
      const kit = await kitFor();
      const reader = await open(kit, { headers: { "Sec-Fetch-Site": site } });
      expect(reader.response.status).toBe(403);
      expect(await reader.response.json()).toEqual({ error: "forbidden" });
      expect(reader.response.headers.get("Cache-Control")).toBe("no-store");
      expect(kit.streams.size()).toBe(0);
    },
  );

  test.each([["same-origin"], [undefined]])(
    "Sec-Fetch-Site: %s is answered",
    async (site) => {
      const kit = await kitFor();
      const reader = await open(kit, { headers: { "Sec-Fetch-Site": site } });
      expect(reader.response.status).toBe(200);
    },
  );
});

describe("replay", () => {
  const ids = (frames: Frame[]) =>
    frames.map((f) => (f.event === "event" ? f.id : f.event));

  test("after Last-Event-ID, the events after it follow the snapshot", async () => {
    const kit = await kitFor();
    await twoEvents(kit);
    const reader = await open(kit, {
      headers: { "Last-Event-ID": `${INSTANCE}.1` },
    });
    const frames = await reader.frames(2);
    expect(ids(frames)).toEqual(["snapshot", `${INSTANCE}.2`]);
    expect((frames[1]?.data as EventEnvelope).id).toBe(`${INSTANCE}.2`);
    // Let the write chain drain, so a repeated event would have arrived.
    await kit.clock.advance(COALESCE_MS);
    expect(reader.queued()).toEqual([]);
  });

  test("after ?after=, the same", async () => {
    const kit = await kitFor();
    await twoEvents(kit);
    const reader = await open(kit, { query: `?after=${INSTANCE}.1` });
    expect(ids(await reader.frames(2))).toEqual(["snapshot", `${INSTANCE}.2`]);
    await kit.clock.advance(COALESCE_MS);
    expect(reader.queued()).toEqual([]);
  });

  test("Last-Event-ID wins over ?after=", async () => {
    const kit = await kitFor();
    await twoEvents(kit);
    const reader = await open(kit, {
      headers: { "Last-Event-ID": `${INSTANCE}.2` },
      query: `?after=${INSTANCE}.1`,
    });
    expect(ids(await reader.frames(1))).toEqual(["snapshot"]);
    await kit.clock.advance(COALESCE_MS);
    expect(reader.queued()).toEqual([]);
  });

  test("an invalid Last-Event-ID never falls back to ?after=", async () => {
    const kit = await kitFor();
    await twoEvents(kit);
    const reader = await open(kit, {
      headers: { "Last-Event-ID": "nonsense" },
      query: `?after=${INSTANCE}.1`,
    });
    expect(ids(await reader.frames(1))).toEqual(["snapshot"]);
    await kit.clock.advance(COALESCE_MS);
    expect(reader.queued()).toEqual([]);
  });

  test("an empty Last-Event-ID never falls back to ?after=", async () => {
    const kit = await kitFor();
    await twoEvents(kit);
    const reader = await open(kit, {
      headers: { "Last-Event-ID": "" },
      query: `?after=${INSTANCE}.1`,
    });
    expect(ids(await reader.frames(1))).toEqual(["snapshot"]);
    await kit.clock.advance(COALESCE_MS);
    expect(reader.queued()).toEqual([]);
  });

  test.each([
    ["the newest ID", () => `${INSTANCE}.2`],
    ["another instance's", () => "other.1"],
    ["x", () => "x"],
    ["a zero", () => `${INSTANCE}.0`],
    ["a leading zero", () => `${INSTANCE}.01`],
    ["no instance", () => ".5"],
    ["10 KB", () => `${INSTANCE}.${"1".repeat(10 * 1024)}`],
  ])("%s replays nothing, with a 200", async (_, value) => {
    const kit = await kitFor();
    await twoEvents(kit);
    for (const options of [
      { headers: { "Last-Event-ID": value() } },
      { query: `?after=${encodeURIComponent(value())}` },
    ]) {
      const reader = await open(kit, options);
      expect(reader.response.status).toBe(200);
      const first = await reader.next();
      expect(first.event).toBe("snapshot");
      expect(JSON.stringify(first)).not.toContain("1".repeat(64));
      await kit.clock.advance(COALESCE_MS);
      expect(reader.queued()).toEqual([]);
    }
  });

  test("a gap, an ID past the buffer's 15 minutes, replays nothing", async () => {
    const kit = await kitFor();
    await twoEvents(kit);
    await kit.clock.advance(EVENT_KEEP_MS + 1);
    const reader = await open(kit, {
      headers: { "Last-Event-ID": `${INSTANCE}.1` },
    });
    expect(ids(await reader.frames(1))).toEqual(["snapshot"]);
    await kit.clock.advance(COALESCE_MS);
    expect(reader.queued().filter((f) => f.event !== "heartbeat")).toEqual([]);
  });
});

describe("live", () => {
  test("an action's snapshot comes before its events, at once", async () => {
    const kit = await kitFor();
    for (const action of [
      { type: "welcome.finish" },
      { type: "lesson.start", help: "planned" },
    ])
      await kit.post(at(kit.host, action));
    const reader = await open(kit);
    await reader.next();
    const response = await kit.post(at(kit.host, { type: "step.markDone" }));
    expect(response.status).toBe(200);
    const { revision } = (await response.json()) as { revision: number };
    const [first, second] = await reader.frames(2);
    expect(first?.event).toBe("snapshot");
    expect(snap(first as Frame).revision).toBe(revision);
    expect(second?.event).toBe("event");
    expect(second?.id).toBe(`${INSTANCE}.1`);
    expect((second?.data as EventEnvelope).id).toBe(`${INSTANCE}.1`);
  });

  test("changes with no events coalesce to the latest within 50 ms", async () => {
    const kit = await kitFor();
    const reader = await open(kit);
    await reader.next();
    await kit.post(at(kit.host, { type: "welcome.finish" }));
    await kit.post(at(kit.host, { type: "lesson.start", help: "planned" }));
    await kit.clock.advance(COALESCE_MS - 1);
    expect(reader.queued()).toEqual([]);
    await kit.clock.advance(1);
    const frames = reader.queued();
    expect(frames.map((f) => f.event)).toEqual(["snapshot"]);
    expect(snap(frames[0] as Frame)).toEqual(kit.host.snapshot());
    await kit.clock.advance(COALESCE_MS);
    expect(reader.queued()).toEqual([]);
  });

  test("a change with events within 50 ms of one without sends one snapshot, then its events", async () => {
    const kit = await kitFor();
    for (const action of [
      { type: "welcome.finish" },
      { type: "lesson.open", lesson: "b-1" },
    ])
      await kit.post(at(kit.host, action));
    const reader = await open(kit);
    await reader.next();
    await kit.post(at(kit.host, { type: "lesson.start", help: "planned" }));
    const response = await kit.post(at(kit.host, { type: "step.markDone" }));
    const { revision } = (await response.json()) as { revision: number };
    const frames = await reader.frames(2);
    expect(frames.map((f) => f.event)).toEqual(["snapshot", "event"]);
    expect(snap(frames[0] as Frame).revision).toBe(revision);
    // Marking the step done also starts its Check, a later change: only
    // snapshots past `revision` may follow, never the coalesced one.
    await kit.clock.advance(COALESCE_MS * 2);
    const stale = reader
      .queued()
      .filter((f) => f.event === "snapshot" && snap(f).revision <= revision);
    expect(stale).toEqual([]);
  });

  test("a heartbeat every 15 seconds with the server time, instance and revision", async () => {
    const kit = await kitFor();
    const reader = await open(kit);
    await reader.next();
    await kit.clock.advance(HEARTBEAT_MS - 1);
    expect(reader.queued()).toEqual([]);
    await kit.clock.advance(1);
    const beat = await reader.next();
    expect(beat).toEqual({
      event: "heartbeat",
      data: {
        serverTime: kit.clock.epoch(),
        instance: INSTANCE,
        revision: kit.host.revision(),
      },
    });
    await kit.clock.advance(HEARTBEAT_MS);
    expect((await reader.next()).event).toBe("heartbeat");
  });

  test("a ninth stream closes the oldest, whose timers go with it", async () => {
    const kit = await kitFor();
    const all: Reader[] = [];
    for (let i = 0; i <= MAX_STREAMS; i++) {
      const reader = await open(kit);
      await reader.next();
      all.push(reader);
    }
    await all[0]?.ended;
    expect(kit.streams.size()).toBe(MAX_STREAMS);
    expect(kit.clock.pending()).toHaveLength(MAX_STREAMS);
    await kit.clock.advance(HEARTBEAT_MS);
    for (const reader of all.slice(1))
      expect((await reader.next()).event).toBe("heartbeat");
  });

  test("a stale-place action is refused while every stream carries the current snapshot", async () => {
    const kit = await kitFor();
    const streams = [await open(kit), await open(kit)];
    for (const reader of streams) await reader.next();
    for (const action of [
      { type: "welcome.finish" },
      { type: "lesson.open", lesson: "b-1" },
    ])
      await kit.post(at(kit.host, action));
    const old = kit.host.revision();
    await kit.post(at(kit.host, { type: "lesson.start", help: "planned" }));
    await kit.clock.advance(COALESCE_MS);
    const response = await kit.post({
      action: { type: "answer.reveal" },
      instance: INSTANCE,
      revision: old,
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { snapshot: Snapshot };
    for (const reader of streams) {
      const frames = reader.queued();
      expect(frames.at(-1)?.event).toBe("snapshot");
      expect(snap(frames.at(-1) as Frame)).toEqual(body.snapshot);
    }
    await kit.clock.advance(COALESCE_MS);
    for (const reader of streams) expect(reader.queued()).toEqual([]);
  });

  test("milestone.shown through POST /api/actions clears it on the stream", async () => {
    const kit = await kitFor({ saved: { unreadable: "moved" } });
    const reader = await open(kit);
    const [milestone] = snap(await reader.next()).milestones;
    const response = await kit.post(
      at(kit.host, { type: "milestone.shown", id: milestone?.id }),
    );
    expect(response.status).toBe(200);
    await kit.clock.advance(COALESCE_MS);
    const frame = await reader.next();
    expect(frame.event).toBe("snapshot");
    expect(snap(frame).milestones).toEqual([]);
  });

  test("an action's input never reaches a frame", async () => {
    const kit = await kitFor();
    const reader = await open(kit);
    await toFirstEvent(kit);
    for (const action of [
      { type: "answer.type", text: "SENTINEL_input_218" },
      {
        type: "folder.choose",
        key: "intermediate",
        to: { path: "/home/sam/SENTINEL_folder_218" },
      },
    ])
      await kit.post(at(kit.host, action));
    await kit.clock.advance(COALESCE_MS);
    const frames = reader.queued();
    expect(frames.length).toBeGreaterThan(1);
    expect(JSON.stringify(frames)).not.toContain("SENTINEL");
  });

  test("closeAll ends every reader and leaves no stream timer or listener", async () => {
    const kit = await kitFor();
    const heard: number[] = [];
    const subscribe = kit.host.subscribe.bind(kit.host);
    kit.host.subscribe = (fn) => {
      heard.push(1);
      const off = subscribe(fn);
      return () => {
        heard.pop();
        off();
      };
    };
    const streams = [await open(kit), await open(kit)];
    for (const reader of streams) await reader.next();
    expect(heard).toHaveLength(2);
    kit.streams.closeAll();
    await Promise.all(streams.map((r) => r.ended));
    expect(kit.clock.pending()).toEqual([]);
    expect(heard).toEqual([]);
  });

  test("a connected reader that never reads closes once its backlog is full", async () => {
    const kit = await kitFor();
    const response = await kit.app.request("/api/events", {
      headers: streamHeaders(),
    });
    expect(response.status).toBe(200);
    expect(kit.streams.size()).toBe(1);
    for (let i = 0; i <= MAX_BACKLOG; i++)
      await kit.clock.advance(HEARTBEAT_MS);
    expect(kit.streams.size()).toBe(0);
    expect(kit.clock.pending()).toEqual([]);
    await response.body?.cancel();
  });

  test("a reader leaving removes its stream, timers and listener", async () => {
    const kit = await kitFor();
    const reader = await open(kit);
    await reader.next();
    expect(kit.streams.size()).toBe(1);
    await reader.close();
    await kit.clock.advance(0);
    expect(kit.streams.size()).toBe(0);
    expect(kit.clock.pending()).toEqual([]);
  });
});
