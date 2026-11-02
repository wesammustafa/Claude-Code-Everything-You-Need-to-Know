// Every real Beginner FAIL message, for the screens' check rung tests
// (beginner-failures.json). Each scenario in
// practice-template/checks/test/ladders/b-*.mjs makes its practice copy and
// runs the item's real check, as the engine's ladder tests do
// (quest/engine/test/ladders/ladder.mjs). It takes minutes, so the JSON is
// written ahead: after a Beginner check's words change, run
// `node quest/client/test/beginner-failures.mjs`.
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { openRepo } from "../../../practice-template/checks/repo.mjs";
import {
  commit,
  repo,
  withRepo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";

export const BEGINNER = ["b-1", "b-2", "b-3", "b-4", "b-5", "b-capstone"];

function failure(id, sc) {
  return withRepo(
    () => repo(),
    (dir) => {
      if (sc.files) write(dir, sc.files);
      if (sc.setup) sc.setup(dir, { write, commit });
      if (sc.command) {
        write(dir, { "bin/claude": sc.command });
        chmodSync(join(dir, "bin/claude"), 0o755);
      }
      const previous = process.env.PATH;
      try {
        if (sc.path) process.env.PATH = join(dir, sc.path);
        return lessons[id].items[sc.item].check(openRepo(dir));
      } finally {
        if (previous === undefined) delete process.env.PATH;
        else process.env.PATH = previous;
      }
    },
  );
}

/** Each Beginner scenario's FAIL message, with its lesson, item and name. */
export async function beginnerFailures() {
  const out = [];
  for (const id of BEGINNER) {
    const { scenarios } = await import(
      `../../../practice-template/checks/test/ladders/${id}.mjs`
    );
    for (const sc of scenarios)
      out.push({
        lesson: id,
        item: lessons[id].items[sc.item].text,
        name: sc.name,
        message: failure(id, sc),
      });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  writeFileSync(
    new URL("beginner-failures.json", import.meta.url),
    `${JSON.stringify(await beginnerFailures(), null, 2)}\n`,
  );
