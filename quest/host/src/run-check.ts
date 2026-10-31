#!/usr/bin/env node
// Runs some or all items of one lesson's check against a folder and prints
// one line of JSON, with the same pass rule as `npm run check`. The lesson
// host runs this in a child process, so a slow item never freezes the screen.
// Before each item it writes {"running": n} to stderr, n counting from 1
// through the items it runs, so the screen can say how far it has got.
//
//   node quest/host/src/run-check.ts <lesson> <dir> [index ...]
//
// The bundle builds it to learn/run-check.mjs.
//
// With --probe, it runs one git probe (probes.ts, ticket 105) in
// the folder instead, and prints {"probe", "pass", "hint", "evidence",
// "state"}:
//
//   node quest/host/src/run-check.ts --probe <name> <dir> [arg ...]
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { probeRepo, type Probed } from "./probes.ts";
import { openRepo } from "../../../practice-template/checks/repo.mjs";

const fail = (error: string): never => {
  console.log(JSON.stringify({ error }));
  process.exit(2);
};
if (process.argv[2] === "--probe") {
  const [, name, dir, ...args] = process.argv.slice(2);
  if (!dir || !existsSync(resolve(dir)))
    fail(`no such folder: ${dir ?? "undefined"}`);
  let out: Probed;
  try {
    out = probeRepo(openRepo(resolve(dir ?? "")), name ?? "", args);
  } catch (error) {
    out = fail(
      `The probe could not run: ${(error as Error).message.split("\n")[0] ?? ""}`,
    );
  }
  console.log(
    JSON.stringify({
      probe: name,
      pass: out.pass,
      hint: out.hint ?? "",
      evidence: out.evidence ?? null,
      state: out.state,
    }),
  );
} else {
  const [lesson = "", dir, ...indexes] = process.argv.slice(2);
  checkItems(lesson, dir, indexes);
}

function checkItems(
  lesson: string,
  dir: string | undefined,
  indexes: string[],
) {
  const found = lessons[lesson] ?? fail(`no check for "${lesson}"`);
  if (!dir || !existsSync(resolve(dir)))
    return fail(`no such folder: ${dir ?? "undefined"}`);
  const { items } = found;
  const wanted = indexes.length ? indexes.map(Number) : items.map((_, i) => i);
  if (wanted.some((i) => !Number.isInteger(i) || !items[i]))
    fail(`no item ${indexes.join(" ")} in ${lesson}`);

  const repo = openRepo(resolve(dir));
  const results = wanted.map((index, k) => {
    const item = items[index] as (typeof items)[number];
    process.stderr.write(`${JSON.stringify({ running: k + 1 })}\n`);
    let outcome: true | string;
    try {
      outcome = item.check(repo);
    } catch {
      // A fixed line, never the error: a failed command's message carries
      // all it printed, and the hint goes to the browser (ticket 212).
      // `npm run check` in the terminal prints the error itself.
      outcome = `The check could not run. To see why, run \`npm run check -- ${lesson}\` in your practice copy, with \`--dir\` and the folder for a work folder.`;
    }
    return {
      index,
      text: item.text,
      local: Boolean(item.local),
      pass: outcome === true,
      hint: outcome === true ? "" : outcome,
    };
  });
  console.log(JSON.stringify({ lesson, items: results }));
}
