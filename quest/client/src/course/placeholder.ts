// Placeholder course data for Progress, until it reads the course from the
// server's snapshot: 250 moves it off and deletes this file. Every other
// screen and the top bar read the snapshot already (221, 243). Each title
// is its Guide page's heading, quoted exactly.
import type { LevelId } from "@quest/contract";
import { LEVEL_NAMES, lessonLabel as placeLabel } from "./labels";

export type { LevelId };

export interface LessonInfo {
  id: string;
  title: string;
  level: LevelId;
  capstone: boolean;
}

export interface LevelInfo {
  id: LevelId;
  name: string;
  lessons: readonly LessonInfo[];
}

function level(
  id: LevelId,
  prefix: string,
  titles: readonly string[],
  capstone: string,
): LevelInfo {
  return {
    id,
    name: LEVEL_NAMES[id],
    lessons: [
      ...titles.map((title, i) => ({
        id: `${prefix}-${String(i + 1)}`,
        title,
        level: id,
        capstone: false,
      })),
      { id: `${prefix}-capstone`, title: capstone, level: id, capstone: true },
    ],
  };
}

export const LEVELS: readonly LevelInfo[] = [
  level(
    "beginner",
    "b",
    [
      "Install, sign in and look around",
      "Choose who approves what: permission modes and plan mode",
      "Your first change, from request to commit",
      "Keep a session on track",
      "Project memory with CLAUDE.md",
    ],
    "Beginner capstone: fix a reported bug, from plan to commit",
  ),
  level(
    "intermediate",
    "i",
    [
      "Turn a repeated workflow into a skill",
      "Organize project memory and see what loaded",
      "Pick the model and effort",
      "Permissions, settings scopes and the sandbox",
      "Enforce a rule with a hook",
      "Delegate to a custom subagent",
      "Connect a tool with MCP",
      "Install and manage plugins",
    ],
    "Intermediate capstone: get a repository ready for a new teammate",
  ),
  level(
    "advanced",
    "a",
    [
      "Parallel sessions with worktrees",
      "Choose an orchestration pattern",
      "Run and save a dynamic workflow",
      "Script Claude Code with `claude -p`",
      "GitHub Actions",
      "Share your setup with a team",
      "Put bounds on autonomous runs",
    ],
    "Advanced capstone: add CI review your team can share",
  ),
];

export const LESSONS: readonly LessonInfo[] = LEVELS.flatMap((l) => l.lessons);

export function levelOf(lesson: LessonInfo): LevelInfo {
  const found = LEVELS.find((l) => l.id === lesson.level);
  if (!found) throw new Error(`No level ${lesson.level}`);
  return found;
}

/** "Lesson 3" or "Capstone", as the Learner reads a lesson's place in its Level. */
export function lessonLabel(lesson: LessonInfo): string {
  const index = levelOf(lesson).lessons.indexOf(lesson);
  return placeLabel(index + 1, lesson.capstone);
}
