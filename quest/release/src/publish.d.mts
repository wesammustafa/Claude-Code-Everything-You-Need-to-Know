// Types for publish.mjs, the Publish of the Practice template.
export const TEMPLATE_REMOTE: string;
export const TAG: RegExp;

export interface PublishOptions {
  tag: string;
  push: boolean;
  cutover: boolean;
  remote: string;
  diff: boolean;
  skipChecksTests: boolean;
  anyClaude: boolean;
}

export type Git = (
  argv: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => string;

export interface PublishSteps {
  checkout(o: {
    repoRoot: string;
    tag: string;
    dir: string;
    git: Git;
  }): string | Promise<string>;
  install(o: { dir: string; env: NodeJS.ProcessEnv }): unknown;
  build(o: { dir: string; env: NodeJS.ProcessEnv }): unknown;
  proof(o: {
    dir: string;
    env: NodeJS.ProcessEnv;
    skipChecksTests: boolean;
    anyClaude: boolean;
    log: (line: string) => void;
  }):
    | { status: number | null; verdict: string | null }
    | Promise<{ status: number | null; verdict: string | null }>;
  assemble(o: {
    dir: string;
    outDir: string;
    env: NodeJS.ProcessEnv;
    log: (line: string) => void;
  }): { ref: string | null } | Promise<{ ref: string | null }>;
}

export function parsePublishArgs(argv: string[]): PublishOptions;
export function releaseMessage(tag: string, sha: string): string;
export function compareTags(a: string, b: string): number;
export function newestTag(tags: string[]): string | null;
export function guardMain(o: {
  main: string | null;
  tags: { name: string; commit: string | null }[];
  tag: string;
  cutover: boolean;
}): string[];
export function pushArgs(remote: string, commit: string, tag: string): string[];
export const runGit: Git;
export function buildCommit(o: {
  git: Git;
  repo: string;
  tree: string;
  parent: string | null;
  tag: string;
  message: string;
  scratch: string;
  env: NodeJS.ProcessEnv;
}): { commit: string; tree: string };
export const defaultSteps: PublishSteps;
export function publish(
  o: Partial<Omit<PublishOptions, "tag" | "remote">> & {
    repoRoot: string;
    tag: string;
    remote: string;
    steps?: Partial<PublishSteps>;
    git?: Git;
    log?: (line: string) => void;
  },
): Promise<number>;
