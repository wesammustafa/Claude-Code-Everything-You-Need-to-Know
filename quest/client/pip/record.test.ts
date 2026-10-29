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
import { encodePng, pngSize } from "./png.ts";
import {
  POSTER_TURNS,
  REST_TOWARD_CONTENT,
  allPosters,
  posterSpec,
} from "./posters.ts";
import {
  NVMRC,
  PIP_DIR,
  RECORD,
  RIVE_CLI_VERSION,
  canonical,
  encoderMismatch,
  expectedOutputs,
  fileDigest,
  nodeMismatch,
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

describe("nodeMismatch", () => {
  test("lets pip:build run on the Node major .nvmrc pins, however .nvmrc writes it", () => {
    for (const nvmrc of ["26", "26\n", "v26", "26.13.0", " v26.1 \n"])
      expect(nodeMismatch("v26.13.0", nvmrc)).toBeNull();
  });

  test("refuses another major, naming both and the way back", () => {
    for (const node of ["v25.9.0", "v27.0.0", "v2.6.0", "v260.0.0"]) {
      const problem = nodeMismatch(node, "26\n");
      expect(problem).toContain(`Node 26, the major .nvmrc pins`);
      expect(problem).toContain(`this is Node ${node}`);
      expect(problem).toContain("`nvm use`");
    }
  });

  test("refuses an .nvmrc it cannot read a major from", () => {
    for (const nvmrc of ["", "lts/*", "node", "twenty-six"])
      expect(nodeMismatch("v26.13.0", nvmrc)).toMatch(
        /^\.nvmrc pins no Node version pip:build can read/,
      );
  });

  test("reads the repository's own .nvmrc", () => {
    const nvmrc = readFileSync(NVMRC, "utf8");
    const major = /\d+/.exec(nvmrc)?.[0] ?? "none";
    expect(nodeMismatch(`v${major}.0.0`, nvmrc)).toBeNull();
  });
});

describe("encoderMismatch", () => {
  const poster = readFileSync(join(PIP_DIR, allPosters()[0]?.file ?? ""));

  test("lets pip:build write posters when this Node re-encodes a committed poster to its own bytes", () => {
    expect(encoderMismatch(poster)).toBeNull();
  });

  test("refuses a zlib that deflates the same pixels to other bytes, naming its version", () => {
    const otherZlib = (image: Parameters<typeof encodePng>[0]) => {
      const bytes = Buffer.from(encodePng(image));
      bytes[bytes.length - 20] = (bytes[bytes.length - 20] ?? 0) ^ 1;
      return bytes;
    };
    const problem = encoderMismatch(poster, otherZlib);
    expect(problem).toContain(`this Node's zlib (${process.versions.zlib})`);
    expect(problem).toContain("would rewrite every poster");
  });
});

describe("the posters' poses", () => {
  test("each poster is drawn at its turn's gaze: beside, toward the content and facing the Learner; at the hero size, facing the Learner", () => {
    const turns = allPosters().map(({ file, turn, data }) => {
      expect(data.gazeX ?? "0", file).toBe(String(POSTER_TURNS[turn]));
      return file;
    });
    expect(
      turns.filter((file) => file.includes("-beside-content.")),
    ).toHaveLength(4);
    expect(
      turns.filter((file) => file.includes("-beside-front.")),
    ).toHaveLength(4);
    expect(turns.filter((file) => file.includes("-hero-front."))).toHaveLength(
      4,
    );
    expect(turns).toHaveLength(12);
    expect(POSTER_TURNS.content).toBe(REST_TOWARD_CONTENT);
    expect(POSTER_TURNS.front).toBe(0);
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
    appendFileSync(join(poster, "posters/idle-hero-front.png"), "x");
    expect(recordProblems(poster)).toEqual([
      `posters/idle-hero-front.png is not the file the last build wrote. ${REBUILD}`,
    ]);

    const riv = copy();
    rmSync(join(riv, "pip.riv"));
    expect(recordProblems(riv)).toEqual([`pip.riv is missing. ${REBUILD}`]);
  });

  test("fails on a poster no build writes", () => {
    const pip = copy();
    cpSync(
      join(pip, "posters/idle-hero-front.png"),
      join(pip, "posters/extra-hero-front.png"),
    );
    expect(recordProblems(pip)).toEqual([
      "posters/extra-hero-front.png is not a poster the build writes",
    ]);
  });

  test("fails when a poster size, the scale, a pose or a turn changes without a rebuild", () => {
    const POSTERS_CHANGED = `the posters' scale, sizes, poses or turns in posters.ts changed since the last build: they are not the ones ${RECORD} records. ${REBUILD}`;
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
      { ...spec, turns: { ...spec.turns, content: 0.5 } },
      { ...spec, sizeTurns: { ...spec.sizeTurns, hero: [] } },
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
    // Each object's keys reversed; a list keeps its order, which means something.
    const reversed = (o: object): unknown =>
      Array.isArray(o)
        ? o
        : Object.fromEntries(
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
      join(pip, "posters/idle-beside-content.png"),
      join(pip, "posters/idle-hero-front.png"),
    );
    const record = readRecord(pip);
    record.outputs["posters/idle-hero-front.png"] = fileDigest(
      join(pip, "posters/idle-hero-front.png"),
    );
    writeFileSync(join(pip, RECORD), JSON.stringify(record));
    expect(recordProblems(pip)).toEqual([
      `posters/idle-hero-front.png is 152 by 152 pixels, not the 416 by 416 posters.ts asks for. ${REBUILD}`,
    ]);

    const broken = copy();
    writeFileSync(join(broken, "posters/idle-hero-front.png"), "not an image");
    expect(recordProblems(broken)).toEqual([
      `posters/idle-hero-front.png is not the file the last build wrote. ${REBUILD}`,
      `posters/idle-hero-front.png is not a PNG. ${REBUILD}`,
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
