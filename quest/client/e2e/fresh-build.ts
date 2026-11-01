// Playwright's global setup: the e2e run tests the built client, so it
// refuses a build made from other sources than the ones checked out: the app
// in dist/app and the Pip contract page in dist/pip-contract.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PIP_CONTRACT_STAMP, STAMP, inputsDigest } from "../build/inputs.ts";

const BUILDS = [
  [STAMP, "dist/app/index.html"],
  [PIP_CONTRACT_STAMP, "dist/pip-contract/index.html"],
] as const;

export default function freshBuild(): void {
  const clientRoot = join(import.meta.dirname, "..");
  const digest = inputsDigest(clientRoot);
  for (const [stamp, page] of BUILDS) {
    const file = join(clientRoot, stamp);
    const built = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
    if (built !== digest || !existsSync(join(clientRoot, page))) {
      throw new Error(
        `quest/client/${page} is missing or was built from other sources than these. Run \`npm run build\`, then \`npm run e2e\`.`,
      );
    }
  }
}
