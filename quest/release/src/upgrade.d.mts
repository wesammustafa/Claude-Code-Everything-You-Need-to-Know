// Types for upgrade.mjs, the upgrade proof.
import type { ProofResult, Snapshot, StepResult } from "./proof.mjs";

export const SECTION: string;
export const SHELLS: string[];
export function readmeCommands(
  markdown: string,
): StepResult & { lines: string[] };
export function shellScript(lines: string[], shell: string): string;
export function shellCommand(shell: string, file: string): string[];
export function insteadOf(repo: string): [string, string];
export function mapPaths(paths: string[]): {
  map: Record<string, string>;
  problems: string[];
};
type Env = NodeJS.ProcessEnv;
export function startCopy(options: {
  copy: string;
  from: string;
  commit: string;
  env: Env;
}): StepResult;
export function templateRepo(options: {
  copy: string;
  repo: string;
  tree: string;
  scratch: string;
  env: Env;
}): StepResult & { commit: string };
export function learnerFiles(options: {
  repoRoot: string;
  copy: string;
  env: Env;
}): StepResult;
export function runCommands(options: {
  copy: string;
  lines: string[];
  shell: string;
  scratch: string;
  env: Env;
}): StepResult & { output?: string };
export function bytesMoved(options: {
  copy: string;
  before: Snapshot;
  after: Snapshot;
  oldPackage: string;
  env: Env;
}): StepResult;
export function checkRuns(options: { copy: string; env: Env }): StepResult;
export function firstSnapshot(
  url: string,
  deadlineMs?: number,
): Promise<unknown>;
export function placeOf(snap: unknown): {
  complete: string[];
  next: string | null;
  lesson: string;
  phase: string;
  step: string | null;
};
export function learnResumes(options: {
  repoRoot: string;
  copy: string;
  env: Env;
}): Promise<StepResult>;
export const defaultSteps: {
  startCopy: typeof startCopy;
  templateRepo: typeof templateRepo;
  learnerFiles: typeof learnerFiles;
  runCommands: typeof runCommands;
  bytesMoved: typeof bytesMoved;
  checkRuns: typeof checkRuns;
  learnResumes: typeof learnResumes;
};
export function runUpgradeProof(options: {
  repoRoot: string;
  template: string;
  from?: string;
  shell?: string;
  keep?: boolean;
  steps?: Partial<typeof defaultSteps>;
  log?: (line: string) => void;
}): Promise<ProofResult[]>;
export function parseUpgradeArgs(
  argv: string[],
  cwd?: string,
): { template: string; from: string | undefined; shell: string; keep: boolean };
