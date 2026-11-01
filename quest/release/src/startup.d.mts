// Types for startup.mjs, start-up of an assembled template.
import type { StepResult } from "./proof.mjs";

export function main(
  dir: string | undefined,
  options?: {
    check?: (
      dir: string,
      options: { chromium: boolean },
    ) => StepResult | Promise<StepResult>;
    log?: (line: string) => void;
    error?: (line: string) => void;
  },
): Promise<number>;
