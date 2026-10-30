// POST /api/actions: the strict schema, the stale place, the wait for open()
// and the answer codes, through the app around a real host on fake
// adapters.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, expectTypeOf, test } from "vitest";
import type { z } from "zod";
import type {
  ActionRequest,
  QuestAction,
  QuestActionType,
} from "@quest/contract";
import { HOST_ACTION_TYPES } from "@quest/host";
import { actionSchema, requestSchema } from "../src/actions.ts";
import { createQueue, type Queue } from "../src/queue.ts";
import { INSTANCE, actionKit, at, questHost } from "./action-kit.ts";

/** One valid action of every type. */
const SAMPLES: Record<QuestActionType, QuestAction> = {
  "welcome.finish": { type: "welcome.finish" },
  "lesson.open": { type: "lesson.open", lesson: "b-1" },
  "lesson.start": { type: "lesson.start", help: "planned" },
  "lesson.restart": { type: "lesson.restart", lesson: "b-1" },
  "lesson.next": { type: "lesson.next" },
  "folder.ask": { type: "folder.ask", key: "intermediate" },
  "folder.choose": {
    type: "folder.choose",
    key: "intermediate",
    to: "practice-copy",
  },
  "folder.cancel": { type: "folder.cancel" },
  "step.continue": { type: "step.continue" },
  "step.back": { type: "step.back" },
  "step.skip": { type: "step.skip" },
  "step.revisit": { type: "step.revisit" },
  "answer.pick": { type: "answer.pick", option: 0 },
  "answer.reveal": { type: "answer.reveal" },
  "answer.type": { type: "answer.type", text: "plan mode" },
  "step.markDone": { type: "step.markDone" },
  "session.ended": { type: "session.ended" },
  "check.run": { type: "check.run" },
  "hint.next": { type: "hint.next" },
  "hint.takeExact": { type: "hint.takeExact", take: true },
  "waitQuestion.answer": { type: "waitQuestion.answer", option: 1 },
  "stepDown.accept": { type: "stepDown.accept" },
  "stepDown.moreHelp": { type: "stepDown.moreHelp" },
  "stepDown.back": { type: "stepDown.back" },
  "milestone.shown": { type: "milestone.shown", id: `${INSTANCE}.1` },
};

async function expectInvalid(response: Response) {
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
}

describe("the schema", () => {
  test("is typed as the contract's actions and request", () => {
    // Checked by tsc (npm run typecheck): an exact equality both ways.
    expectTypeOf<z.infer<typeof actionSchema>>().toEqualTypeOf<QuestAction>();
    expectTypeOf<
      z.infer<typeof requestSchema>
    >().toEqualTypeOf<ActionRequest>();
  });

  test("covers exactly the host's action types", () => {
    const types = actionSchema.options.map((o) => o.shape.type.value);
    expect([...types].sort()).toEqual([...HOST_ACTION_TYPES].sort());
    expect(Object.keys(SAMPLES).sort()).toEqual([...HOST_ACTION_TYPES].sort());
  });

  test.each(Object.entries(SAMPLES))(
    "a valid %s is accepted",
    async (_, action) => {
      const kit = await actionKit();
      const response = await kit.post(at(kit.host, action));
      expect([200, 409]).toContain(response.status);
      expect(kit.dispatched).toEqual([action]);
    },
  );

  test.each(Object.entries(SAMPLES))(
    "%s with an extra key is refused",
    async (_, action) => {
      const kit = await actionKit();
      await expectInvalid(
        await kit.post(at(kit.host, { ...action, extra: 1 })),
      );
      expect(kit.dispatched).toEqual([]);
    },
  );

  test("an unknown action is refused", async () => {
    const kit = await actionKit();
    await expectInvalid(
      await kit.post(
        at(kit.host, { type: "check.runCommand", command: "rm -rf /" }),
      ),
    );
    await expectInvalid(await kit.post(at(kit.host, { type: "constructor" })));
    expect(kit.dispatched).toEqual([]);
  });

  test("a __proto__ key is refused", async () => {
    const kit = await actionKit();
    const request = JSON.stringify(at(kit.host, { type: "welcome.finish" }));
    await expectInvalid(
      await kit.post(request.replace('{"type"', '{"__proto__":{"x":1},"type"')),
    );
    await expectInvalid(
      await kit.post(request.replace('{"action"', '{"__proto__":{},"action"')),
    );
    expect(kit.dispatched).toEqual([]);
  });

  test("an extra key on the request is refused", async () => {
    const kit = await actionKit();
    await expectInvalid(
      await kit.post({ ...at(kit.host, SAMPLES["welcome.finish"]), now: 1 }),
    );
  });

  test("a typed answer of 200 characters is accepted, 201 refused", async () => {
    const kit = await actionKit();
    const ok = await kit.post(
      at(kit.host, { type: "answer.type", text: "x".repeat(200) }),
    );
    expect(ok.status).not.toBe(400);
    await expectInvalid(
      await kit.post(
        at(kit.host, { type: "answer.type", text: "x".repeat(201) }),
      ),
    );
  });

  test.each([
    ["a lesson id", { type: "lesson.open", lesson: "b".repeat(65) }],
    ["a folder key", { type: "folder.ask", key: "k".repeat(65) }],
    ["a milestone id", { type: "milestone.shown", id: "m".repeat(129) }],
    ["an empty lesson id", { type: "lesson.open", lesson: "" }],
    ["an option past 99", { type: "answer.pick", option: 100 }],
    ["a fractional option", { type: "answer.pick", option: 1.5 }],
    ["a negative option", { type: "answer.pick", option: -1 }],
    [
      "a help other than planned or less",
      { type: "lesson.start", help: "none" },
    ],
    ["a string take", { type: "hint.takeExact", take: "yes" }],
  ])("%s out of bounds is refused", async (_, action) => {
    const kit = await actionKit();
    await expectInvalid(await kit.post(at(kit.host, action)));
  });

  test("a missing instance is refused", async () => {
    const kit = await actionKit();
    await expectInvalid(
      await kit.post({
        action: SAMPLES["welcome.finish"],
        revision: kit.host.revision(),
      }),
    );
  });

  test("a missing revision is refused", async () => {
    const kit = await actionKit();
    await expectInvalid(
      await kit.post({ action: SAMPLES["welcome.finish"], instance: INSTANCE }),
    );
  });

  test("malformed JSON is a 400 with no log", async () => {
    const kit = await actionKit();
    await expectInvalid(await kit.post('{"action":'));
    await expectInvalid(await kit.post(""));
    expect(kit.logged).toEqual([]);
  });
});

describe("folder.choose's path", () => {
  const choose = (path: string) => ({
    type: "folder.choose",
    key: "intermediate",
    to: { path },
  });
  const accepted = async (path: string) => {
    let seen: string | undefined;
    const kit = await actionKit({
      checkFolder: (p) => {
        seen = p;
        return Promise.resolve({ refused: "missing" });
      },
    });
    const response = await kit.post(at(kit.host, choose(path)));
    return { response, seen };
  };

  test("an absolute path of 1,024 characters reaches the folder check", async () => {
    const path = `/${"p".repeat(1023)}`;
    const { response, seen } = await accepted(path);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "folder",
      reason: "missing",
    });
    expect(seen).toBe(path);
  });

  test.each([
    ["1,025 characters", `/${"p".repeat(1024)}`],
    ["a NUL", "/home/sam/repo\0x"],
    ["a CR", "/home/sam/repo\rx"],
    ["an LF", "/home/sam/repo\nx"],
    ["a relative path", "repo"],
    ["a home-relative path", "~/repo"],
    ["an empty path", ""],
  ])("%s is refused before the folder check", async (_, path) => {
    const { response, seen } = await accepted(path);
    await expectInvalid(response);
    expect(seen).toBeUndefined();
  });

  test("the resolved path is what the host is given", async () => {
    const kit = await actionKit({
      checkFolder: () => Promise.resolve({ path: "/home/sam/real" }),
    });
    await kit.post(at(kit.host, choose("/home/sam/link")));
    expect(kit.dispatched).toEqual([
      {
        type: "folder.choose",
        key: "intermediate",
        to: { path: "/home/sam/real" },
      },
    ]);
  });
});

describe("the place", () => {
  test("a stale place is a 409 with the current snapshot, and changes nothing", async () => {
    const kit = await actionKit();
    for (const action of [SAMPLES["welcome.finish"], SAMPLES["lesson.open"]])
      expect((await kit.post(at(kit.host, action))).status).toBe(200);
    const old = kit.host.revision();
    // Starting the Lesson moves the Learner's place.
    expect((await kit.post(at(kit.host, SAMPLES["lesson.start"]))).status).toBe(
      200,
    );
    const revision = kit.host.revision();
    const snapshot = JSON.stringify(kit.host.snapshot());
    expect(revision).toBeGreaterThan(old);
    const response = await kit.post({
      action: SAMPLES["answer.reveal"],
      instance: INSTANCE,
      revision: old,
    });
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as {
      revision: number;
      snapshot: unknown;
    };
    expect(body.revision).toBe(revision);
    expect(JSON.stringify(body.snapshot)).toBe(snapshot);
    expect(kit.host.revision()).toBe(revision);
    expect(JSON.stringify(kit.host.snapshot())).toBe(snapshot);
  });

  test("another instance's revision is a 409", async () => {
    const kit = await actionKit();
    const response = await kit.post({
      action: SAMPLES["welcome.finish"],
      instance: "other",
      revision: kit.host.revision(),
    });
    expect(response.status).toBe(409);
  });

  test("an applied action answers 200 with the revision and snapshot after it", async () => {
    const kit = await actionKit();
    const response = await kit.post(at(kit.host, SAMPLES["welcome.finish"]));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      revision: number;
      snapshot: { revision: number };
    };
    expect(body.revision).toBe(kit.host.revision());
    expect(body.snapshot.revision).toBe(body.revision);
  });
});

describe("before the snapshot", () => {
  test("a POST while open() is pending waits, then answers 200", async () => {
    const host = questHost();
    const opened = Promise.withResolvers<undefined>();
    // The task signals when it starts, so the test knows it is parked on
    // `ready` without waiting on the clock.
    const inner = createQueue();
    const started = Promise.withResolvers<undefined>();
    const queue: Queue = {
      run: (task) =>
        inner.run(() => {
          started.resolve(undefined);
          return task();
        }),
      size: () => inner.size(),
    };
    const kit = await actionKit({
      host,
      open: false,
      ready: opened.promise,
      queue,
    });
    const pending = kit.post(at(host, SAMPLES["welcome.finish"]));
    let settled = false;
    void pending.then(() => (settled = true));
    await started.promise;
    expect(settled).toBe(false);
    expect(kit.dispatched).toEqual([]);
    await host.open();
    opened.resolve(undefined);
    const response = await pending;
    expect(response.status).toBe(409);
    // Its revision was the one before open(): the place has moved since.
    const again = await kit.post(at(host, SAMPLES["welcome.finish"]));
    expect(again.status).toBe(200);
  });

  test("a failed open() answers 503 with Retry-After", async () => {
    const host = questHost();
    const kit = await actionKit({
      host,
      open: false,
      ready: Promise.reject(new Error("git failed")),
    });
    const response = await kit.post({
      action: SAMPLES["welcome.finish"],
      instance: INSTANCE,
      revision: 0,
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.json()).toEqual({ error: "starting" });
    expect(kit.dispatched).toEqual([]);
    expect(kit.logged).toEqual([]);
  });
});

describe("no action names a command, a script or a file", () => {
  test("no action's fields are a command, script, file or path, except folder.choose's checked folder", () => {
    const fields = actionSchema.options.flatMap((o) =>
      Object.keys(o.shape).map((key) => `${o.shape.type.value}.${key}`),
    );
    const named = fields.filter((field) =>
      /command|script|file|path|cmd|exec|args|dir/i.test(
        field.split(".").pop() ?? "",
      ),
    );
    expect(named).toEqual([]);
    // The only path anywhere is inside folder.choose's `to`, a folder the
    // server checks and the host only looks at.
    expect(JSON.stringify(SAMPLES)).not.toMatch(/command|script/i);
  });

  test("check.run takes no field: a Check is chosen by the Lesson", () => {
    expect(
      Object.keys(
        actionSchema.options.find((o) => o.shape.type.value === "check.run")
          ?.shape ?? {},
      ),
    ).toEqual(["type"]);
  });

  test("the server's source spawns nothing an action could name", () => {
    const dir = new URL("../src/", import.meta.url);
    const src = readdirSync(dir)
      .map((name) => readFileSync(new URL(name, dir), "utf8"))
      .join("\n");
    expect(src).not.toMatch(/\beval\(|new Function\(/);
  });
});
