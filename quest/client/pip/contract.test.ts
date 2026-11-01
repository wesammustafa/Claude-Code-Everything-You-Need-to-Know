// @vitest-environment node
// The comparison the Playwright contract test runs on the loaded .riv: it
// passes the exact contract and names every way a rig departs from it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  PIP_MODES,
  PIP_PROPERTIES,
  PIP_REACTIONS,
  contractProblems,
  type RigShape,
} from "./contract.ts";

// What the web runtime reports for a rig that is exactly the contract.
function exact(): RigShape {
  return {
    artboards: [{ name: "Pip", stateMachines: [{ name: "Pip", inputs: [] }] }],
    defaultViewModel: "Pip",
    viewModels: [
      {
        name: "Pip",
        properties: [
          { name: "mode", type: "enumType", enumName: "PipMode" },
          ...PIP_REACTIONS.map((name) => ({ name, type: "trigger" })),
          { name: "intensity", type: "number" },
          { name: "reducedMotion", type: "boolean" },
          { name: "gazeX", type: "number" },
          { name: "gazeY", type: "number" },
        ],
      },
    ],
    enums: [{ name: "PipMode", values: ["idle", "thinking", "rest", "sleep"] }],
  };
}

function withProperties(
  edit: (
    properties: RigShape["viewModels"][number]["properties"],
  ) => RigShape["viewModels"][number]["properties"],
): RigShape {
  const shape = exact();
  const [viewModel] = shape.viewModels;
  if (!viewModel) throw new Error("no view model");
  viewModel.properties = edit(viewModel.properties);
  return shape;
}

describe("contractProblems", () => {
  test("passes the exact contract", () => {
    expect(contractProblems(exact())).toEqual([]);
  });

  test("names the contract's properties: the mode enum, six triggers, intensity, reducedMotion, gazeX and gazeY", () => {
    expect(PIP_MODES).toEqual(["idle", "thinking", "rest", "sleep"]);
    expect(PIP_PROPERTIES).toEqual({
      mode: "enumType",
      greeting: "trigger",
      curious: "trigger",
      explaining: "trigger",
      success: "trigger",
      retry: "trigger",
      celebration: "trigger",
      intensity: "number",
      reducedMotion: "boolean",
      gazeX: "number",
      gazeY: "number",
    });
  });

  test("fails when a property is renamed", () => {
    const shape = withProperties((ps) =>
      ps.map((p) => (p.name === "gazeX" ? { ...p, name: "gazeQ" } : p)),
    );
    expect(contractProblems(shape)).toEqual([
      "Pip has no property gazeX",
      "Pip has a property gazeQ the contract does not name",
    ]);
  });

  test("fails when a property is added", () => {
    const shape = withProperties((ps) => [
      ...ps,
      { name: "wave", type: "trigger" },
    ]);
    expect(contractProblems(shape)).toEqual([
      "Pip has a property wave the contract does not name",
    ]);
  });

  test("fails when a property is removed", () => {
    const shape = withProperties((ps) =>
      ps.filter((p) => p.name !== "celebration"),
    );
    expect(contractProblems(shape)).toEqual([
      "Pip has no property celebration",
    ]);
  });

  test("fails when a property changes type", () => {
    const shape = withProperties((ps) =>
      ps.map((p) =>
        p.name === "retry"
          ? { ...p, type: "boolean" }
          : p.name === "intensity"
            ? { ...p, type: "string" }
            : p,
      ),
    );
    expect(contractProblems(shape)).toEqual([
      "retry is a boolean, not a trigger",
      "intensity is a string, not a number",
    ]);
  });

  test("fails when a property is named twice", () => {
    const shape = withProperties((ps) => [
      ...ps,
      { name: "gazeY", type: "number" },
    ]);
    expect(contractProblems(shape)).toEqual([
      "Pip names a property more than once",
    ]);
  });

  test("fails when the modes change: a value renamed, added, removed or reordered", () => {
    for (const values of [
      ["idle", "thinking", "rest", "nap"],
      ["idle", "thinking", "rest", "sleep", "busy"],
      ["idle", "thinking", "rest"],
      ["idle", "thinking", "sleep", "rest"],
    ]) {
      const shape = exact();
      shape.enums = [{ name: "PipMode", values }];
      expect(contractProblems(shape)).toEqual([
        `PipMode's values are ${values.join(", ")}; the contract's are idle, thinking, rest, sleep`,
      ]);
    }
  });

  test("fails when mode takes another enum, or another enum is added", () => {
    const other = withProperties((ps) =>
      ps.map((p) => (p.name === "mode" ? { ...p, enumName: "Mood" } : p)),
    );
    other.enums.push({ name: "Mood", values: ["happy"] });
    expect(contractProblems(other)).toEqual([
      "mode takes the enum Mood, not PipMode",
      "enums are PipMode, Mood; the contract has only PipMode",
    ]);
  });

  test("fails on another artboard, state machine or view model, and on state machine inputs", () => {
    const shape = exact();
    shape.artboards = [
      {
        name: "Pip",
        stateMachines: [
          { name: "Pip", inputs: ["hop"] },
          { name: "Extra", inputs: [] },
        ],
      },
      { name: "Icon", stateMachines: [] },
    ];
    shape.viewModels.push({ name: "Other", properties: [] });
    expect(contractProblems(shape)).toEqual([
      "artboards are Pip, Icon; the contract has only Pip",
      "Pip's state machines are Pip, Extra; the contract has only Pip",
      "state machine Pip has inputs (hop); the rig is driven only through its view model",
      "view models are Pip, Other; the contract has only Pip",
    ]);
  });

  test("fails when the artboard is bound to no view model", () => {
    const shape = exact();
    shape.defaultViewModel = null;
    expect(contractProblems(shape)).toEqual([
      "the artboard is bound to view model (none), not Pip",
    ]);
  });
});

// The rig's own source, read without the CLI: the view model it declares is
// the contract, so a renamed property fails here before any build.
describe("the rig's view-model.rml", () => {
  const rml = readFileSync(
    join(import.meta.dirname, "rig/view-model.rml"),
    "utf8",
  ).replace(/<!--[\s\S]*?-->/g, "");
  const TYPE: Record<string, string> = {
    EnumCustom: "enumType",
    Trigger: "trigger",
    Number: "number",
    Boolean: "boolean",
    String: "string",
    Color: "color",
  };

  test("declares exactly the contract's properties and types", () => {
    const declared = Object.fromEntries(
      [...rml.matchAll(/<ViewModelProperty(\w+)\b[^>]*\bname="([^"]+)"/g)].map(
        ([, kind = "", name = ""]) => [name, TYPE[kind] ?? kind],
      ),
    );
    expect(declared).toEqual(PIP_PROPERTIES);
  });

  test("declares the mode enum with exactly the three modes, in order", () => {
    const enums = [
      ...rml.matchAll(
        /<DataEnumCustom\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/DataEnumCustom>/g,
      ),
    ];
    expect(enums.map(([, name]) => name)).toEqual(["PipMode"]);
    const values = [
      ...(enums[0]?.[2] ?? "").matchAll(
        /<DataEnumValue\b[^>]*\bkey="([^"]+)"/g,
      ),
    ].map(([, key]) => key);
    expect(values).toEqual([...PIP_MODES]);
  });
});
