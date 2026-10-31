// Types for budgets.mjs, the size budgets of an assembled template.
export interface Budget {
  id: string;
  label: string;
  limit: number;
  unit: "bytes" | "ms";
  on: boolean;
}

export interface BudgetRow extends Budget {
  value?: number;
  error?: string;
  detail?: string;
}

export const BUDGETS: readonly Readonly<Budget>[];
export function formatBytes(bytes: number): string;
export function measureTree(
  dir: string,
  options?: { manifestFile?: string; on?: Record<string, boolean> },
): BudgetRow[];
export interface StartupOptions {
  runs?: number;
  command?: string[];
  deadline?: number;
}
export function startupMs(
  dir: string,
  options?: StartupOptions,
): Promise<{ median: number; times: number[] }>;
export function measureStartup(
  dir: string,
  options?: StartupOptions,
): Promise<BudgetRow>;
export function budgetProblems(rows: BudgetRow[]): string[];
export function report(rows: BudgetRow[]): { text: string; markdown: string };
