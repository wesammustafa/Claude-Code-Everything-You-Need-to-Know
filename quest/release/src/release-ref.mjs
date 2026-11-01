// The ref a release build points GitHub links and example fetches at: the
// release tag when the build has one, else the commit being built.
import { execFileSync } from "node:child_process";

export function releaseRef(root, env = process.env) {
  if (env.QUEST_RELEASE_TAG) return env.QUEST_RELEASE_TAG;
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}
