// Types for proof.mjs, the fresh-copy proof.
export interface StepResult {
  ok: boolean;
  problems: string[];
  note?: string;
  skipped?: boolean;
  partial?: boolean;
}

export interface ProofResult extends StepResult {
  n: number;
  name: string;
  ms?: number;
}

export interface Stopped {
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stopLine: boolean;
  portFree: boolean;
}

export function stopProblems(stopped: Stopped): string[];

export interface Learn {
  url: string;
  ms: number;
  stop(waitMs?: number): Promise<Stopped>;
  output(): string;
}

export type Snapshot = Record<string, { sha256: string; mode: number }>;

export function baselineVersion(text: string): string;
export function snapshot(dir: string): Snapshot;
export function sameBytes(a: Snapshot, b: Snapshot): string[];
export function treeProblems(dir: string): string[];
export function starterTests(
  copy: string,
  options?: { command?: string[] },
): StepResult;
export function checksTests(
  repoRoot: string,
  options?: { command?: string[] },
): StepResult;
export function freshFails(copy: string): StepResult;
export function replayPasses(options: {
  repoRoot: string;
  copy: string;
  solutionsDir?: string;
  claude?: string;
  anyClaude?: boolean;
}): StepResult;
export function startLearn(
  dir: string,
  options?: { env?: NodeJS.ProcessEnv; deadlineMs?: number },
): Promise<Learn>;
export function serves(
  dir: string,
  options?: { chromium?: boolean; deadlineMs?: number },
): Promise<StepResult>;
export function verdict(results: ProofResult[]): {
  failed: boolean;
  line: string;
};

type Step<A extends unknown[]> = (
  ...args: A
) => StepResult | Promise<StepResult>;

/** Step 6's second `npm run build` in the repo. */
export function rebuild(repoRoot: string): StepResult;

export function runProof(options: {
  repoRoot: string;
  skipChecksTests?: boolean;
  anyClaude?: boolean;
  keep?: boolean;
  chromium?: boolean;
  inputs?: {
    learnDir?: string;
    pagesIndexFile?: string;
    releaseCourse?: string;
  };
  writeNotices?: (root: string, outFile: string) => unknown;
  solutionsDir?: string;
  steps?: {
    assemble?: (options: {
      repoRoot: string;
      outDir: string;
      inputs?: unknown;
      writeNotices?: unknown;
    }) => Promise<{ ref: string }>;
    rebuild?: Step<[string]>;
    starterTests?: Step<[string]>;
    checksTests?: Step<[string]>;
    freshFails?: Step<[string]>;
    replayPasses?: Step<[Parameters<typeof replayPasses>[0]]>;
    serves?: Step<[string, { chromium?: boolean }]>;
    treeProblems?: (dir: string) => string[];
  };
  log?: (line: string) => void;
}): Promise<ProofResult[]>;
