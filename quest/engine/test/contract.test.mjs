// The shared contract (quest/contract) is types only, so the engine keeps
// the runtime lists. This holds them equal (ticket 212): each event type
// the contract names is one EVENT_TYPES holds, each action type one
// ACTION_TYPES holds (with milestone.shown, which the host takes), and each
// Level one the manifest names.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACTION_TYPES, EVENT_TYPES } from "./drive.mjs";
import { LEVELS } from "../src/course.mjs";

const contract = (file) =>
  readFileSync(new URL(`../../contract/src/${file}`, import.meta.url), "utf8");
// The `type: "..."` literals of a contract file's interfaces.
const typeLiterals = (text) =>
  [...text.matchAll(/^\s+type: "([^"]+)";$/gm)].map((m) => m[1]);

test("the contract's events are the engine's EVENT_TYPES, in order", () => {
  assert.deepEqual(typeLiterals(contract("events.ts")), [...EVENT_TYPES]);
});

test("the contract's actions are the engine's ACTION_TYPES and milestone.shown", () => {
  assert.deepEqual(
    typeLiterals(contract("actions.ts")).sort(),
    [...ACTION_TYPES, "milestone.shown"].sort(),
  );
});

test("the contract's Levels are the manifest's", () => {
  const m = contract("common.ts").match(/export type LevelId =([^;]+);/);
  assert.ok(m, "LevelId");
  assert.deepEqual(
    [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
    LEVELS,
  );
});
