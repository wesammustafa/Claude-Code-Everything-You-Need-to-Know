// Reads an event envelope from untrusted data: what arrives over the page's
// own event source today, and over the stream once the connection layer
// lands. Only the contract's fields are copied, each checked for its type, so
// nothing else rides along into the director.
import type {
  EventEnvelope,
  EventHeader,
  HelpTier,
  LevelId,
  QuestEvent,
  QuestEventType,
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
