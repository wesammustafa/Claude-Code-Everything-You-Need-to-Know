// Whether a module is the script Node was started with. A plain string
// compare of process.argv[1] and the module path can miss on Windows, where
// the two may differ in drive-letter case, slash form or an 8.3 short name;
// the guarded main() then never runs and the step exits 0 having checked
// nothing. Both sides go through realpath, and win32 compares case-folded.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function canonical(path, platform) {
  let full = resolve(path);
  try {
    full = realpathSync.native(full);
  } catch {
    // A path that does not exist stays resolved but not real.
  }
  return platform === "win32" ? full.toLowerCase() : full;
}

/** True when `moduleUrl` (import.meta.url) is the entry script `argv1`. */
export function isMain(
  moduleUrl,
  argv1 = process.argv[1],
  platform = process.platform,
) {
  if (!argv1) return false;
  return (
    canonical(argv1, platform) === canonical(fileURLToPath(moduleUrl), platform)
  );
}
