// Types for legacy-fingerprints.mjs, the Terminal app's Lesson fingerprints.
export function legacyFingerprints(
  lessonsDir: string,
  manifestValue: unknown,
  commit: string,
  template?: string,
): { template: string; commit: string; lessons: Record<string, string> };
