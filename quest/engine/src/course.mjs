// The course as the engine reads it (ticket 210): the manifest's path and
// levels, the compiled course (dist/course.json, from npm run
// course:compile), and the pure step-file parser bound to the manifest and
// the Checks. The pure parser is content.mjs; this module reads files.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  coursePath,
  folderKeys,
  indexLevel as manifestIndexLevel,
  parseLesson as parseContent,
  workLevels,
} from "./content.mjs";
import { lessons as checks } from "../../../practice-template/checks/lessons/index.mjs";
import { PROBES, probeError } from "./probes.mjs";

const manifest = JSON.parse(
  readFileSync(
    new URL("../../../course/manifest.json", import.meta.url),
    "utf8",
  ),
);
const compiled = JSON.parse(
  readFileSync(new URL("../dist/course.json", import.meta.url), "utf8"),
);
const byId = new Map(compiled.lessons.map((lesson) => [lesson.id, lesson]));

export const PATH = coursePath(manifest).map((entry) => {
  const lesson = byId.get(entry.id);
  return {
    id: entry.id,
    level: entry.level,
    page: entry.page,
    minutes: lesson.minutes,
    ...(entry.folder === "copy" && entry.level !== "beginner"
      ? { folder: "copy" }
      : {}),
    ...(entry.folder === "new-copy" ? { newCopy: true } : {}),
  };
});
export const LEVELS = manifest.levels.map((level) => level.id);
export const WORK_LEVELS = workLevels(manifest);
export const FOLDER_KEYS = folderKeys(manifest);
export const SLOW = Object.fromEntries(
  compiled.lessons
    .filter((lesson) => lesson.slow.length)
    .map((lesson) => [lesson.id, lesson.slow]),
);
export const indexLevel = (id) => manifestIndexLevel(manifest, id);

export function parseLesson(text, file = "lesson") {
  return parseContent(text, file, {
    manifest,
    checks,
    probes: { PROBES, probeError },
  });
}

export function loadCourse(root, path = PATH) {
  const useCompiled =
    resolve(root) ===
    resolve(new URL("../../../practice-template", import.meta.url).pathname);
  return path.map((entry, at) => {
    const lesson = byId.get(entry.id);
    if (!lesson)
      throw new Error(`course/manifest.json:1: unknown Lesson ${entry.id}`);
    const file = join(root, "learn", "lessons", `${entry.id}.md`);
    const content = useCompiled
      ? {
          ...lesson.content,
          title: lesson.title,
          next: lesson.next,
          stuck: lesson.stuck,
          page: lesson.url,
        }
      : existsSync(file)
        ? parseLesson(
            readFileSync(file, "utf8"),
            `learn/lessons/${entry.id}.md`,
          )
        : null;
    const late = content?.requires.find(
      (requirement) =>
        requirement.lesson &&
        !path
          .slice(0, at)
          .some((previous) => previous.id === requirement.lesson),
    );
    if (late)
      throw new Error(
        `learn/lessons/${entry.id}.md: requires ${late.lesson}, no lesson before ${entry.id} here`,
      );
    if (content?.worked && !content.folder && (entry.folder || entry.newCopy))
      throw new Error(
        `learn/lessons/${entry.id}.md: worked: copy, but ${entry.id} runs every step in ${entry.newCopy ? "its new copy" : "the practice copy"}`,
      );
    return {
      ...entry,
      title: checks[entry.id].title,
      url: lesson.url,
      stuck: lesson.stuck,
      items: lesson.items,
      slow: lesson.slow,
      content,
    };
  });
}
