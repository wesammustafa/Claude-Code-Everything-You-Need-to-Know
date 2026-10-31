// Types for replay.mjs, the Reference solutions' replay.
export const RESTORE: Readonly<Record<string, string>>;
export function gitEnv(extra?: Record<string, string>): NodeJS.ProcessEnv;
export function lessonOrder(repoRoot: string): string[];
export function prepareCopy(copy: string): void;
export function applyLesson(options: {
  repoRoot: string;
  copy: string;
  id: string;
  solutionsDir?: string;
}): void;
export function replay(options: {
  repoRoot: string;
  copy: string;
  through?: string;
  solutionsDir?: string;
  onLesson?: (id: string) => void;
}): void;
