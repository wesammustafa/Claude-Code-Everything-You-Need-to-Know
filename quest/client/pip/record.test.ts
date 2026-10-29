// @vitest-environment node
// CI never runs the Rive CLI, so it holds the committed build to its record:
// the rig's sources must hash to what `npm run pip:build` recorded, the
// posters' spec must be the one it rendered to, and each output must be the
// file that build wrote.
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { pngSize } from "./png.ts";
import { allPosters, posterSpec } from "./posters.ts";
import {
  PIP_DIR,
  RECORD,
  RIVE_CLI_VERSION,
  canonical,
  expectedOutputs,
  fileDigest,
  readRecord,
  recordProblems,
  rigDigest,
} from "./record.ts";

const REBUILD = "Run `npm run pip:build` and commit what it writes.";
const RIG_CHANGED = `the rig's sources changed since the last build: their hash is not the one ${RECORD} records. ${REBUILD}`;

describe("the committed Pip build", () => {
  test("matches its record: the rig hashes to the recorded hash, and every output is the one the build wrote", () => {
    expect(recordProblems(PIP_DIR)).toEqual([]);
  });

  test("was built with the pinned Rive CLI, and records the .riv and every poster", () => {
    const record = readRecord(PIP_DIR);
    expect(record.rive).toBe(RIVE_CLI_VERSION);
    expect(Object.keys(record.outputs).sort()).toEqual(expectedOutputs());
    expect(record.rig).toBe(rigDigest(join(PIP_DIR, "rig")));
    expect(record.posters).toEqual(posterSpec());
  });

  test("has every poster at twice its size in PIP_SIZES", () => {
    for (const { file, px } of allPosters()) {
      expect(pngSize(readFileSync(join(PIP_DIR, file))), file).toEqual({
        width: px,
        height: px,
      });
    }
  });
});

describe("recordProblems", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0))
      rmSync(dir, { recursive: true, force: true });
  });

  // A copy of quest/client/pip/ with its rig, outputs and record.
  function copy(): string {
    const root = mkdtempSync(join(tmpdir(), "pip-record-"));
    temps.push(root);
    const dir = join(root, "pip");
    cpSync(PIP_DIR, dir, { recursive: true });
    expect(recordProblems(dir)).toEqual([]);
    return dir;
  }

  test("fails when an RML file changes without a rebuild", () => {
    const pip = copy();
    appendFileSync(join(pip, "rig/pip.rml"), "<!-- an edit -->\n");
    expect(recordProblems(pip)).toEqual([RIG_CHANGED]);
  });

  test("fails when the view model is edited without a rebuild", () => {
    const pip = copy();
    const file = join(pip, "rig/view-model.rml");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace('name="gazeX"', 'name="gazeQ"'),
    );
    expect(recordProblems(pip)).toEqual([RIG_CHANGED]);
  });

  test("fails when a rig file is added, removed or renamed, or the project config changes", () => {
    const added = copy();
    writeFileSync(
      join(added, "rig/extra.rml"),
      '<Rive version="1" kind="fragment"/>\n',
    );
    expect(recordProblems(added)).toEqual([RIG_CHANGED]);

    const removed = copy();
    rmSync(join(removed, "rig/view-model.rml"));
    expect(recordProblems(removed)).toEqual([RIG_CHANGED]);

    const renamed = copy();
    cpSync(
      join(renamed, "rig/view-model.rml"),
      join(renamed, "rig/zz-view-model.rml"),
    );
    rmSync(join(renamed, "rig/view-model.rml"));
    expect(recordProblems(renamed)).toEqual([RIG_CHANGED]);

    const config = copy();
    appendFileSync(join(config, "rig/rive.yaml"), "# a note\n");
    expect(recordProblems(config)).toEqual([RIG_CHANGED]);
  });

  test("hashes bytes, so line endings count", () => {
    const pip = copy();
    const file = join(pip, "rig/rive.yaml");
    writeFileSync(file, readFileSync(file, "utf8").replace(/\n/g, "\r\n"));
    expect(recordProblems(pip)).toEqual([RIG_CHANGED]);
  });

  test("counts an RML file in a folder of the rig", () => {
    const pip = copy();
    mkdirSync(join(pip, "rig/parts"));
    writeFileSync(
      join(pip, "rig/parts/extra.rml"),
      '<Rive version="1" kind="fragment"/>\n',
    );
    expect(recordProblems(pip)).toEqual([RIG_CHANGED]);
  });

  test("hashes only the sources, so a file git ignores (the .DS_Store Finder writes) changes nothing", () => {
    const pip = copy();
    const digest = rigDigest(join(pip, "rig"));
    writeFileSync(join(pip, "rig/.DS_Store"), "Finder");
    mkdirSync(join(pip, "rig/.claude"));
    writeFileSync(join(pip, "rig/.claude/settings.local.json"), "{}\n");
    writeFileSync(join(pip, "posters/.DS_Store"), "Finder");
    expect(rigDigest(join(pip, "rig"))).toBe(digest);
    expect(recordProblems(pip)).toEqual([]);
  });

  test("leaves out the build folder a CLI preview writes into the rig", () => {
    const pip = copy();
    mkdirSync(join(pip, "rig/build"), { recursive: true });
    writeFileSync(join(pip, "rig/build/pip.riv"), "preview");
    expect(recordProblems(pip)).toEqual([]);
  });

  test("fails when an output differs from the one the build wrote, or is missing", () => {
    const poster = copy();
    appendFileSync(join(poster, "posters/idle-hero.png"), "x");
    expect(recordProblems(poster)).toEqual([
      `posters/idle-hero.png is not the file the last build wrote. ${REBUILD}`,
    ]);

    const riv = copy();
    rmSync(join(riv, "pip.riv"));
    expect(recordProblems(riv)).toEqual([`pip.riv is missing. ${REBUILD}`]);
  });

  test("fails on a poster no build writes", () => {
    const pip = copy();
    cpSync(
      join(pip, "posters/idle-hero.png"),
      join(pip, "posters/extra-hero.png"),
    );
    expect(recordProblems(pip)).toEqual([
      "posters/extra-hero.png is not a poster the build writes",
    ]);
  });

  test("fails when a poster size, the scale or a pose changes without a rebuild", () => {
    const POSTERS_CHANGED = `the posters' scale, sizes or poses in posters.ts changed since the last build: they are not the ones ${RECORD} records. ${REBUILD}`;
    const spec = posterSpec();
    const changes = [
      { ...spec, sizes: { ...spec.sizes, beside: 96 } },
      { ...spec, scale: 3 },
      {
        ...spec,
        poses: {
          ...spec.poses,
          happy: { ...spec.poses.happy, advance: "100ms" },
        },
      },
      {
        ...spec,
        poses: {
          ...spec.poses,
          idle: { data: { mode: "rest" }, advance: "1" },
        },
      },
    ];
    for (const posters of changes) {
      const pip = copy();
      const record = readRecord(pip);
      writeFileSync(join(pip, RECORD), JSON.stringify({ ...record, posters }));
      expect(recordProblems(pip)).toEqual([POSTERS_CHANGED]);
    }
  });

  test("reads the poster spec whatever order its keys are in", () => {
    const pip = copy();
    const record = readRecord(pip);
    const reversed = (o: object): unknown =>
      Object.fromEntries(
        Object.entries(o)
          .reverse()
          .map(([k, v]) => [
            k,
            typeof v === "object" && v !== null ? reversed(v as object) : v,
          ]),
      );
    writeFileSync(
      join(pip, RECORD),
      JSON.stringify({ ...record, posters: reversed(record.posters) }),
    );
    expect(recordProblems(pip)).toEqual([]);
    expect(canonical(reversed(posterSpec()))).toEqual(canonical(posterSpec()));
  });

  test("fails on a poster at another size than posters.ts asks for, even one the record vouches for", () => {
    const pip = copy();
    cpSync(
      join(pip, "posters/idle-beside.png"),
      join(pip, "posters/idle-hero.png"),
    );
    const record = readRecord(pip);
    record.outputs["posters/idle-hero.png"] = fileDigest(
      join(pip, "posters/idle-hero.png"),
    );
    writeFileSync(join(pip, RECORD), JSON.stringify(record));
    expect(recordProblems(pip)).toEqual([
      `posters/idle-hero.png is 152 by 152 pixels, not the 416 by 416 posters.ts asks for. ${REBUILD}`,
    ]);

    const broken = copy();
    writeFileSync(join(broken, "posters/idle-hero.png"), "not an image");
    expect(recordProblems(broken)).toEqual([
      `posters/idle-hero.png is not the file the last build wrote. ${REBUILD}`,
      `posters/idle-hero.png is not a PNG. ${REBUILD}`,
    ]);
  });

  test("fails on a record from another CLI version, or none", () => {
    const other = copy();
    const record = readRecord(other);
    writeFileSync(
      join(other, RECORD),
      JSON.stringify({ ...record, rive: "1.6.0" }),
    );
    expect(recordProblems(other)).toEqual([
      `the outputs were built with Rive CLI 1.6.0, not the pinned ${RIVE_CLI_VERSION}. ${REBUILD}`,
    ]);

    const none = copy();
    rmSync(join(none, RECORD));
    expect(recordProblems(none)).toEqual([`${RECORD} is missing. ${REBUILD}`]);
  });
});
