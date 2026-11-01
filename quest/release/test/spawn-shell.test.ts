// npm, npx and claude are .cmd shims on Windows, which spawn starts only
// through a shell. Every literal spawn of one of them in the release scripts
// and the Checks must pass a shell: option, or it fails with ENOENT or EINVAL
// there while passing everywhere else.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { repoRoot } from "./pages-fixture";

const folders = ["quest/release/src", "practice-template/checks"];
const call = /\bspawn(?:Sync)?\(\s*["'](npm|npx|claude)["']/g;

function sites() {
  const found: { site: string; options: string }[] = [];
  for (const folder of folders) {
    for (const name of readdirSync(join(repoRoot, folder))) {
      if (!name.endsWith(".mjs")) continue;
      const text = readFileSync(join(repoRoot, folder, name), "utf8");
      for (const match of text.matchAll(call)) {
        const line = text.slice(0, match.index).split("\n").length;
        // The call's text up to its closing "});".
        const end = text.indexOf("});", match.index);
        found.push({
          site: `${folder}/${name}:${String(line)}`,
          options: text.slice(match.index, end),
        });
      }
    }
  }
  return found;
}

test("the scan finds the known spawns of npm", () => {
  expect(sites().map((s) => s.site)).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^quest\/release\/src\/proof\.mjs:/),
    ]),
  );
});

test("every spawn of npm, npx or claude passes a shell: option", () => {
  const missing = sites()
    .filter((s) => !/\bshell:/.test(s.options))
    .map((s) => s.site);
  expect(missing).toEqual([]);
});
