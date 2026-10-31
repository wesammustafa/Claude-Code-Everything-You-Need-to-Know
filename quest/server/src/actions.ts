// POST /api/actions, the action boundary (spec, Server security): a body of
// at most 16 KB, strict JSON that names one action from the contract's
// catalogue with every string capped, run one at a time through the queue,
// folder.choose's path checked before the host sees it, then the host's
// dispatch. No action names a command, a script or a file to read: a Check
// is chosen by Lesson id.
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type {
  ActionError,
  ActionResponse,
  FolderRefusal,
} from "@quest/contract";
import type { Host } from "@quest/host";
import type { Checked } from "./folders.ts";
import { PATH_LIMIT } from "./folders.ts";
import { API_CACHE } from "./headers.ts";
import type { Queue } from "./queue.ts";

export const BODY_LIMIT = 16 * 1024;
export const TEXT_LIMIT = 200;
const ID_LIMIT = 64;
const EVENT_ID_LIMIT = 128;
const OPTION_LIMIT = 99;

const id = z.string().min(1).max(ID_LIMIT);
const option = z.int().min(0).max(OPTION_LIMIT);
// An absolute path, at most 1,024 characters, with no NUL and no line break.
const path = z
  .string()
  .min(1)
  .max(PATH_LIMIT)
  .refine((p) => !/[\0\r\n]/.test(p), "a control character")
  .refine((p) => p.startsWith("/") || /^[a-z]:[\\/]/i.test(p), "not absolute");

const bare = <T extends string>(type: T) =>
  z.strictObject({ type: z.literal(type) });

export const actionSchema = z.discriminatedUnion("type", [
  bare("welcome.finish"),
  z.strictObject({ type: z.literal("lesson.open"), lesson: id }),
  z.strictObject({
    type: z.literal("lesson.start"),
    help: z.enum(["planned", "less"]),
  }),
  z.strictObject({ type: z.literal("lesson.restart"), lesson: id }),
  bare("lesson.next"),
  z.strictObject({ type: z.literal("folder.ask"), key: id }),
  z.strictObject({
    type: z.literal("folder.choose"),
    key: id,
    to: z.union([z.literal("practice-copy"), z.strictObject({ path })]),
  }),
  bare("folder.cancel"),
  bare("step.continue"),
  bare("step.back"),
  bare("step.skip"),
  bare("step.revisit"),
  z.strictObject({ type: z.literal("answer.pick"), option }),
  bare("answer.reveal"),
  z.strictObject({
    type: z.literal("answer.type"),
    text: z.string().max(TEXT_LIMIT),
  }),
  bare("step.markDone"),
  bare("session.ended"),
  bare("check.run"),
  bare("hint.next"),
  z.strictObject({ type: z.literal("hint.takeExact"), take: z.boolean() }),
  z.strictObject({ type: z.literal("waitQuestion.answer"), option }),
  bare("stepDown.accept"),
  bare("stepDown.moreHelp"),
  bare("stepDown.back"),
  z.strictObject({
    type: z.literal("milestone.shown"),
    id: z.string().min(1).max(EVENT_ID_LIMIT),
  }),
]);

export const requestSchema = z.strictObject({
  action: actionSchema,
  instance: id,
  revision: z.int().min(0),
});

export type CheckFolder = (path: string) => Promise<Checked>;

export interface ActionsOptions {
  host: Host;
  /** Settles when the host's open() settles. */
  ready: Promise<unknown>;
  queue: Queue;
  checkFolder: CheckFolder;
}

function refuse(c: Context, body: ActionError, status: 400 | 413 | 429 | 503) {
  c.header("Cache-Control", API_CACHE);
  return c.json(body, status);
}

export function actionRoute(
  app: Hono,
  { host, ready, queue, checkFolder }: ActionsOptions,
): void {
  // Settled either way: a failed open() answers 503, never an error.
  const opened = ready.then(
    () => undefined,
    () => undefined,
  );
  app.post(
    "/api/actions",
    bodyLimit({
      maxSize: BODY_LIMIT,
      onError: (c) => refuse(c, { error: "too large" }, 413),
    }),
    async (c) => {
      let body: unknown;
      try {
        body = JSON.parse(await c.req.text());
      } catch {
        return refuse(c, { error: "invalid" }, 400);
      }
      const parsed = requestSchema.safeParse(body);
      if (!parsed.success) return refuse(c, { error: "invalid" }, 400);
      const { action, instance, revision } = parsed.data;

      const queued = queue.run(async () => {
        await opened;
        if (host.snapshot() === null)
          return { status: 503 as const, body: { error: "starting" as const } };
        let sent = action;
        if (action.type === "folder.choose" && action.to !== "practice-copy") {
          const checked = await checkFolder(action.to.path);
          if ("refused" in checked)
            return {
              status: 400 as const,
              body: {
                error: "folder" as const,
                reason: checked.refused satisfies FolderRefusal,
              },
            };
          sent = { ...action, to: { path: checked.path } };
        }
        const done = host.dispatch(sent, { revision, instance });
        if (done.snapshot === null)
          return { status: 503 as const, body: { error: "starting" as const } };
        const reply: ActionResponse = {
          revision: done.revision,
          snapshot: done.snapshot,
        };
        return {
          status: done.stale ? (409 as const) : (200 as const),
          body: reply,
        };
      });
      if (!queued) return refuse(c, { error: "busy" }, 429);
      const { status, body: answer } = await queued;
      c.header("Cache-Control", API_CACHE);
      if (status === 503) c.header("Retry-After", "1");
      return c.json(answer, status);
    },
  );
}
