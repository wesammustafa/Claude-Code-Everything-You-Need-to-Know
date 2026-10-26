// @vitest-environment node
// The Pip rules CI can check without the CLI: quest/client/pip/ holds no agent
// instructions file (`rive create` writes CLAUDE.md and AGENTS.md into a
// project) and no script (the rig stays script-free: the web runtimes reject
// unsigned scripts).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { PIP_DIR, strayFiles } from "./record.ts";

describe("quest/client/pip/", () => {
  test("holds no CLAUDE.md, no AGENTS.md and no script", () => {
    expect(strayFiles(PIP_DIR)).toEqual([]);
  });
});

describe("strayFiles", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0))
      rmSync(dir, { recursive: true, force: true });
  });

  function pipDir(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "pip-guard-"));
    temps.push(dir);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    return dir;
  }

  test("passes a rig of RML, its project config and its outputs", () => {
    const dir = pipDir({
      "rig/rive.yaml": "name: pip\n",
      "rig/pip.rml": '<Rive version="1" kind="fragment"/>\n',
      "pip.riv": "",
      "posters/idle-hero.png": "",
    });
    expect(strayFiles(dir)).toEqual([]);
  });

  test("finds the agent instructions files rive create writes, anywhere and in any case", () => {
    const dir = pipDir({
      "rig/CLAUDE.md": "",
      "rig/AGENTS.md": "",
      "Claude.md": "",
      "rig/CLAUDE.local.md": "",
    });
    expect(strayFiles(dir).map((line) => line.split(":")[0])).toEqual([
      "Claude.md",
      "rig/AGENTS.md",
      "rig/CLAUDE.local.md",
      "rig/CLAUDE.md",
    ]);
  });

  test("finds Luau and AnimaScript files", () => {
    const dir = pipDir({ "rig/blink.luau": "", "rig/wave.as": "" });
    expect(strayFiles(dir)).toEqual([
      "rig/blink.luau: a script; Pip's rig stays script-free",
      "rig/wave.as: a script; Pip's rig stays script-free",
    ]);
  });

  test("finds RML that embeds a script, a script module, a script input or a scripted object", () => {
    const dir = pipDir({
      "rig/asset.rml": '<Rive><ScriptAsset file="x.luau" name="x"/></Rive>',
      "rig/drawable.rml": "<Rive><ScriptedDrawable/></Rive>",
      "rig/input.rml": '<Rive><ScriptInputNumber name="n" id="0:2"/></Rive>',
      "rig/module.rml":
        '<Rive><ScriptModuleAsset language="luau" name="m" id="0:1"/></Rive>',
      "rig/plain.rml": '<Rive><Node name="Script"/></Rive>',
    });
    const found = (file: string) =>
      `${file}: RML with a script in it; Pip's rig stays script-free`;
    expect(strayFiles(dir)).toEqual([
      found("rig/asset.rml"),
      found("rig/drawable.rml"),
      found("rig/input.rml"),
      found("rig/module.rml"),
    ]);
  });
});
