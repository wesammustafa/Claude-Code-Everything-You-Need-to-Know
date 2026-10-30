// The course as the engine reads it (ticket 210): the manifest's path and
// levels, the compiled course (dist/course.json, from npm run
// course:compile), and the pure step-file parser bound to the manifest and
// the Checks. The pure parser is content.ts. courseFrom builds the course
// from a compiled course it is given; loadCourse reads dist/course.json on
// its first call.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import manifestJson from "../../../course/manifest.json" with { type: "json" };
import {
  coursePath,
  folderKeys,
  indexLevel as manifestIndexLevel,
  must,
  parseLesson as parseContent,
  workLevels,
  type CheckModule,
  type CompiledCourse,
  type CompiledLesson,
  type LessonContent,
  type Manifest,
} from "./content.ts";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { PROBES, probeError } from "./probes.ts";
import type { CourseEntry, PathEntry } from "./types.ts";

// The manifest as course/manifest.json holds it, read as it is: the course
// compile step checks it.
const manifest = manifestJson as Manifest;
const checks: Readonly<Record<string, CheckModule | undefined>> = lessons;

export const PATH: PathEntry[] = coursePath(manifest).map((entry) => ({
  id: entry.id,
  level: entry.level,
  page: entry.page,
  ...(entry.folder === "copy" && entry.level !== "beginner"
    ? { folder: "copy" as const }
    : {}),
  ...(entry.folder === "new-copy" ? { newCopy: true as const } : {}),
  // A lesson of a level that practises in a work folder (the engine's
  // levelKey reads it, so engine.mjs imports no file-reading module).
  ...(entry.folder === "work" ? { work: true as const } : {}),
}));
export const LEVELS = manifest.levels.map((level) => level.id);
export const WORK_LEVELS = workLevels(manifest);
export const FOLDER_KEYS = folderKeys(manifest);
export const SLOW: Readonly<Record<string, number[]>> = Object.fromEntries(
  coursePath(manifest)
    .filter((lesson) => lesson.slow.length)
    .map((lesson) => [lesson.id, lesson.slow]),
);
export const indexLevel = (id: string) => manifestIndexLevel(manifest, id);

export function parseLesson(text: string, file = "lesson") {
  return parseContent(text, file, {
    manifest,
    checks,
    probes: { PROBES, probeError },
  });
}

// One course entry: its path entry, the compiled lesson's page fields and
// its content. A Lesson the compiled course lacks, a requirement on no
// lesson before it here, and worked: copy where every step runs in a copy
// are errors.
function entryOf(
  entry: PathEntry,
  at: number,
  path: readonly PathEntry[],
  byId: ReadonlyMap<string, CompiledLesson>,
  contentOf: (lesson: CompiledLesson) => LessonContent | null,
  compiled: boolean,
): CourseEntry {
  const lesson = byId.get(entry.id);
  if (!lesson)
    throw new Error(`course/manifest.json:1: unknown Lesson ${entry.id}`);
  const content = contentOf(lesson);
  const late = content?.requires.find(
    (requirement) =>
      requirement.lesson &&
      !path.slice(0, at).some((previous) => previous.id === requirement.lesson),
  );
  if (late)
    throw new Error(
      `learn/lessons/${entry.id}.md: requires ${String(late.lesson)}, no lesson before ${entry.id} here`,
    );
  if (content?.worked && !content.folder && (entry.folder || entry.newCopy))
    throw new Error(
      `learn/lessons/${entry.id}.md: worked: copy, but ${entry.id} runs every step in ${entry.newCopy ? "its new copy" : "the practice copy"}`,
    );
  // The page's time estimate goes right after its page, where the path
  // entry held it before ticket 214.
  const { id, level, page, ...pins } = entry;
  return {
    id,
    level,
    page,
    minutes: lesson.minutes,
    ...pins,
    title: must(
      checks[entry.id],
      `course/manifest.json:1: no Check module for ${entry.id}`,
    ).title,
    url: lesson.url,
    stuck: lesson.stuck,
    items: lesson.items,
    slow: lesson.slow,
    content,
    // The course file's fingerprints, which the engine compares a save
    // with (ticket 213); a step file read on its own has none.
    ...(compiled && {
      fingerprint: lesson.fingerprint,
      legacyFingerprint: lesson.legacyFingerprint,
    }),
  };
}

// The course from a compiled course (dist/course.json's contents), with
// its fingerprints. Pure: it reads no file.
export function courseFrom(
  compiled: CompiledCourse,
  path: readonly PathEntry[] = PATH,
): CourseEntry[] {
  const byId = new Map(compiled.lessons.map((lesson) => [lesson.id, lesson]));
  return path.map((entry, at) =>
    entryOf(
      entry,
      at,
      path,
      byId,
      (lesson) => ({
        ...lesson.content,
        title: lesson.title,
        next: lesson.next,
        stuck: lesson.stuck,
        page: lesson.url,
      }),
      true,
    ),
  );
}

// The compiled course, read once, on the first loadCourse.
let compiledCourse: CompiledCourse | undefined;

// The course for a practice root: the template's own is the compiled
// course; any other reads each lesson's step file from its learn/lessons/,
// with no fingerprints, or none where it has no file.
export function loadCourse(
  root: string,
  path: readonly PathEntry[] = PATH,
): CourseEntry[] {
  compiledCourse ??= JSON.parse(
    readFileSync(new URL("../dist/course.json", import.meta.url), "utf8"),
  ) as CompiledCourse;
  const useCompiled =
    resolve(root) ===
    resolve(new URL("../../../practice-template", import.meta.url).pathname);
  if (useCompiled) return courseFrom(compiledCourse, path);
  const byId = new Map(
    compiledCourse.lessons.map((lesson) => [lesson.id, lesson]),
  );
  return path.map((entry, at) =>
    entryOf(
      entry,
      at,
      path,
      byId,
      () => {
        const file = join(root, "learn", "lessons", `${entry.id}.md`);
        return existsSync(file)
          ? parseLesson(
              readFileSync(file, "utf8"),
              `learn/lessons/${entry.id}.md`,
            )
          : null;
      },
      false,
    ),
  );
}
