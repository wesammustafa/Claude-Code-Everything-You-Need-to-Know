// Types for template.mjs, the Practice template's assembly.
export interface Manifest {
  levels: { id: string }[];
  lessons: { id: string; level: string; page: string; check: string }[];
}

export interface PagesIndex {
  ref: string;
  pages: { path: string; title: string }[];
}

export const FORBIDDEN: readonly string[];
export function templateProblems(dir: string): string[];
export function layoutProblems(dir: string): string[];
export function importProblems(code: string): string[];
export function lessonIndex(manifest: Manifest): string;
export function progressChecklist(
  manifest: Manifest,
  pagesIndex: PagesIndex,
): string;
export function templateReadme(source: string, ref: string): string;
export function learnReadme(ref: string): string;
export function rootPackage(): Record<string, unknown>;
export function assembleTemplate(options: {
  repoRoot: string;
  outDir: string;
  inputs?: {
    learnDir?: string;
    pagesIndexFile?: string;
    releaseCourse?: string;
  };
  writeNotices?: (root: string, outFile: string) => unknown;
}): Promise<{ ref: string }>;
