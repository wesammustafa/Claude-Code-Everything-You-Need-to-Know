// Playwright's global setup: the e2e run tests the built client, so it
// refuses a dist/app built from other sources than the ones checked out.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STAMP, inputsDigest } from "../build/inputs.ts";

export default function freshBuild(): void {
  const clientRoot = join(import.meta.dirname, "..");
  const stamp = join(clientRoot, STAMP);
  const built = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() : "";
  if (
    built !== inputsDigest(clientRoot) ||
    !existsSync(join(clientRoot, "dist/app/index.html"))
  ) {
    throw new Error(
      "quest/client/dist/app is missing or was built from other sources than these. Run `npm run build`, then `npm run e2e`.",
    );
  }
}
