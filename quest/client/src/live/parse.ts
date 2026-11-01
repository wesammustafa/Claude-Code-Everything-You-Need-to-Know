// Reads what the server sends from untrusted data: the stream's frames and the
// action and health answers. An event's fields are copied only as the contract
// names them, each checked for its type, so nothing else rides along into the
// director; a snapshot's header and pending milestones are checked the same way.
import type {
  ActionError,
  ActionResponse,
  EventEnvelope,
  EventHeader,
  FolderRefusal,
  HealthResponse,
  Heartbeat,
  HelpTier,
  LevelId,
  Milestone,
  QuestEvent,
  QuestEventType,
  Snapshot,
} from "@quest/contract";

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isFlag = (value: unknown): value is boolean => typeof value === "boolean";

const HELP_TIERS: readonly HelpTier[] = ["guided", "hinted", "challenge"];
const LEVELS: readonly LevelId[] = ["beginner", "intermediate", "advanced"];
const isTier = (value: unknown): value is HelpTier =>
  HELP_TIERS.some((tier) => tier === value);
const isLevel = (value: unknown): value is LevelId =>
  LEVELS.some((level) => level === value);

/** Each event type's own fields, read and checked; null when they are wrong. */
const READERS: {
  [T in QuestEventType]: (
    fields: Fields,
  ) => Extract<QuestEvent, { type: T }> | null;
} = {
  "check.started": () => ({ type: "check.started" }),
  "check.progress": ({ n, m }) =>
    isCount(n) && isCount(m) ? { type: "check.progress", n, m } : null,
  "check.passed": ({ firstTime }) =>
    isFlag(firstTime) ? { type: "check.passed", firstTime } : null,
  "check.notYet": ({ evidence }) =>
    isText(evidence) ? { type: "check.notYet", evidence } : null,
  "check.broken": () => ({ type: "check.broken" }),
  "check.ended": () => ({ type: "check.ended" }),
  "answer.right": () => ({ type: "answer.right" }),
  "answer.wrong": () => ({ type: "answer.wrong" }),
  "hint.shown": ({ rung }) =>
    isCount(rung) ? { type: "hint.shown", rung } : null,
  "warmup.recalled": () => ({ type: "warmup.recalled" }),
  "warmup.missed": () => ({ type: "warmup.missed" }),
  "step.completed": () => ({ type: "step.completed" }),
  "stepDown.reached": ({ from, to }) =>
    isTier(from) && isTier(to) ? { type: "stepDown.reached", from, to } : null,
  "lesson.completed": ({ badge, capstone, firstTime }) => {
    if (!isFlag(capstone) || !isFlag(firstTime)) return null;
    if (badge === undefined)
      return { type: "lesson.completed", capstone, firstTime };
    return isText(badge)
      ? { type: "lesson.completed", badge, capstone, firstTime }
      : null;
  },
  "level.completed": ({ level }) =>
    isLevel(level) ? { type: "level.completed", level } : null,
  "course.completed": () => ({ type: "course.completed" }),
  "work.changed": () => ({ type: "work.changed" }),
  "help.offered": () => ({ type: "help.offered" }),
  notice: ({ kind }) => (isText(kind) ? { type: "notice", kind } : null),
};

const isEventType = (value: unknown): value is QuestEventType =>
  isText(value) && Object.hasOwn(READERS, value);

/** One event envelope, or null when the value is not one. */
export function readEventEnvelope(value: unknown): EventEnvelope | null {
  if (!isRecord(value)) return null;
  const { id, revision, serverTime, type } = value;
  if (!isText(id) || id === "" || !isCount(revision) || !isCount(serverTime))
    return null;
  if (!isEventType(type)) return null;
  const event = READERS[type](value);
  if (event === null) return null;
  const header: EventHeader = { id, revision, serverTime };
  return { ...header, ...event };
}

/** The event types a snapshot's pending milestones carry. */
export const MILESTONE_TYPES: ReadonlySet<QuestEventType> = new Set([
  "lesson.completed",
  "level.completed",
  "course.completed",
  "notice",
]);

const isMilestone = (envelope: EventEnvelope): envelope is Milestone =>
  MILESTONE_TYPES.has(envelope.type);

const isRevision = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

/**
 * A snapshot, or null when its header is wrong. Only the header and the
 * pending milestones are checked: the rest is the screens' to read, and a
 * milestone that is not well formed is dropped.
 */
export function readSnapshot(value: unknown): Snapshot | null {
  if (!isRecord(value)) return null;
  const { instance, revision, milestones } = value;
  if (!isText(instance) || instance === "" || !isRevision(revision))
    return null;
  if (!Array.isArray(milestones)) return null;
  const pending = (milestones as unknown[]).flatMap((item) => {
    const envelope = readEventEnvelope(item);
    return envelope !== null && isMilestone(envelope) ? [envelope] : [];
  });
  return {
    ...(value as unknown as Snapshot),
    instance,
    revision,
    milestones: pending,
  };
}

/** A heartbeat, or null. */
export function readHeartbeat(value: unknown): Heartbeat | null {
  if (!isRecord(value)) return null;
  const { serverTime, instance, revision } = value;
  if (!isCount(serverTime) || !isText(instance) || !isRevision(revision))
    return null;
  return { serverTime, instance, revision };
}

/** The body of a `200` or a stale `409` action answer, or null. */
export function readActionResponse(value: unknown): ActionResponse | null {
  if (!isRecord(value)) return null;
  const snapshot = readSnapshot(value.snapshot);
  if (snapshot === null || snapshot.revision !== value.revision) return null;
  return { revision: snapshot.revision, snapshot };
}

const SIMPLE_ERRORS = [
  "forbidden",
  "invalid",
  "too large",
  "busy",
  "starting",
] as const;
const FOLDER_REFUSALS: readonly FolderRefusal[] = [
  "missing",
  "too-long",
  "outside-home",
  "is-copy",
  "contains-copy",
  "not-repo-root",
];

/** The body of a refused action, or null. */
export function readActionError(value: unknown): ActionError | null {
  if (!isRecord(value)) return null;
  const { error, reason } = value;
  if (error === "folder") {
    const known = FOLDER_REFUSALS.find((refusal) => refusal === reason);
    return known === undefined ? null : { error, reason: known };
  }
  const simple = SIMPLE_ERRORS.find((name) => name === error);
  return simple === undefined ? null : { error: simple };
}

/** `GET /api/health`'s body, or null. */
export function readHealth(value: unknown): HealthResponse | null {
  if (!isRecord(value)) return null;
  const { ok, instance } = value;
  return ok === true && isText(instance) && instance !== ""
    ? { ok, instance }
    : null;
}
