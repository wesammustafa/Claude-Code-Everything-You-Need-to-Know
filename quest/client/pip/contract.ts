// Pip's renderer contract as the rig carries it: the artboard, state machine
// and view model names the app's Rive adapter drives Pip by, and nothing else.
// The rig's view-model.rml declares these; the contract test loads the built
// .riv in the web runtime and compares what it reports with them.

export const PIP_ARTBOARD = "Pip";
export const PIP_STATE_MACHINE = "Pip";
export const PIP_VIEW_MODEL = "Pip";
export const PIP_MODE_ENUM = "PipMode";

/** The modes Pip holds, in the enum's order. */
export const PIP_MODES = ["idle", "thinking", "rest", "sleep"] as const;
export type PipMode = (typeof PIP_MODES)[number];

/** The Reactions Pip plays once, one trigger each. */
export const PIP_REACTIONS = [
  "greeting",
  "curious",
  "explaining",
  "success",
  "retry",
  "celebration",
] as const;
export type PipReactionKind = (typeof PIP_REACTIONS)[number];

/** Where Pip sits: large and centred, beside the step, or the static icon. */
export type PipSize = "hero" | "beside" | "icon";

/**
 * The one model that drives both the Rive renderer and the static fallback,
 * as the spec's renderer contract defines it. Pip's director produces it.
 */
export interface PipModel {
  mode: PipMode;
  /** 0..1 intensity; a new id plays once. */
  reaction: { id: string; kind: PipReactionKind; intensity: number } | null;
  /** -1..1, clamped; null: the rig's own glances. */
  gaze: { x: number; y: number } | null;
  /**
   * Where Pip rests on this screen, -1..1: the gaze the poster is drawn at.
   * The gaze moves away from it for a moment (the pointer, a glance, a look),
   * which only the live rig follows, so the poster stays a calm stand-in.
   */
  restingGaze: { x: number; y: number };
  /** The system setting or the Settings override. */
  reducedMotion: boolean;
  size: PipSize;
}

type ContractProperties = { mode: "enumType" } & Record<
  PipReactionKind,
  "trigger"
> & {
    intensity: "number";
    reducedMotion: "boolean";
    gazeX: "number";
    gazeY: "number";
  };

/**
 * The view model's properties, with the type names the web runtime reports:
 * the mode enum, one trigger per Reaction, intensity (0 to 1), reducedMotion,
 * and gazeX and gazeY (-1 to 1).
 */
export const PIP_PROPERTIES = {
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
} as const satisfies ContractProperties;
export type PipProperty = keyof typeof PIP_PROPERTIES;

/** What a loaded Rive file says about itself, as read through the web runtime. */
export interface RigShape {
  artboards: {
    name: string;
    stateMachines: { name: string; inputs: string[] }[];
  }[];
  /** The view model the default artboard is bound to, if any. */
  defaultViewModel: string | null;
  viewModels: {
    name: string;
    properties: { name: string; type: string; enumName?: string | undefined }[];
  }[];
  enums: { name: string; values: string[] }[];
}

/** How the contract test drives a loaded rig: by the contract's names only. */
export interface PipDriver {
  shape(): RigShape;
  setMode(mode: PipMode): void;
  fire(reaction: PipReactionKind): void;
  setNumber(name: "intensity" | "gazeX" | "gazeY", value: number): void;
  setReducedMotion(value: boolean): void;
  /** The mode the view model holds. */
  mode(): string;
  /** Whether the state machine is playing. */
  playing(): boolean;
}

const list = (names: readonly string[]) =>
  names.length === 0 ? "none" : names.join(", ");

/**
 * Every way the shape differs from the contract, in words; empty when it is
 * exactly the contract. One artboard, one state machine with no inputs (they
 * are deprecated), one view model with exactly the contract's properties and
 * types, and one enum with exactly the three modes in order.
 */
export function contractProblems(shape: RigShape): string[] {
  const problems: string[] = [];
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((value, i) => value === b[i]);

  const artboards = shape.artboards.map((a) => a.name);
  if (!same(artboards, [PIP_ARTBOARD])) {
    problems.push(
      `artboards are ${list(artboards)}; the contract has only ${PIP_ARTBOARD}`,
    );
  }
  const artboard = shape.artboards.find((a) => a.name === PIP_ARTBOARD);
  if (artboard) {
    const machines = artboard.stateMachines.map((m) => m.name);
    if (!same(machines, [PIP_STATE_MACHINE])) {
      problems.push(
        `${PIP_ARTBOARD}'s state machines are ${list(machines)}; the contract has only ${PIP_STATE_MACHINE}`,
      );
    }
    for (const machine of artboard.stateMachines) {
      if (machine.inputs.length > 0) {
        problems.push(
          `state machine ${machine.name} has inputs (${list(machine.inputs)}); the rig is driven only through its view model`,
        );
      }
    }
  }

  if (shape.defaultViewModel !== PIP_VIEW_MODEL) {
    problems.push(
      `the artboard is bound to view model ${shape.defaultViewModel ?? "(none)"}, not ${PIP_VIEW_MODEL}`,
    );
  }
  const viewModels = shape.viewModels.map((v) => v.name);
  if (!same(viewModels, [PIP_VIEW_MODEL])) {
    problems.push(
      `view models are ${list(viewModels)}; the contract has only ${PIP_VIEW_MODEL}`,
    );
  }
  const viewModel = shape.viewModels.find((v) => v.name === PIP_VIEW_MODEL);
  if (viewModel) {
    const actual = new Map(viewModel.properties.map((p) => [p.name, p]));
    for (const [name, type] of Object.entries(PIP_PROPERTIES)) {
      const property = actual.get(name);
      if (!property) {
        problems.push(`${PIP_VIEW_MODEL} has no property ${name}`);
      } else if (property.type !== type) {
        problems.push(`${name} is a ${property.type}, not a ${type}`);
      }
    }
    for (const property of viewModel.properties) {
      if (!(property.name in PIP_PROPERTIES)) {
        problems.push(
          `${PIP_VIEW_MODEL} has a property ${property.name} the contract does not name`,
        );
      }
    }
    if (viewModel.properties.length !== actual.size) {
      problems.push(`${PIP_VIEW_MODEL} names a property more than once`);
    }
    const mode = actual.get("mode");
    if (mode?.type === PIP_PROPERTIES.mode && mode.enumName !== PIP_MODE_ENUM) {
      problems.push(
        `mode takes the enum ${mode.enumName ?? "(none)"}, not ${PIP_MODE_ENUM}`,
      );
    }
  }

  const enums = shape.enums.map((e) => e.name);
  if (!same(enums, [PIP_MODE_ENUM])) {
    problems.push(
      `enums are ${list(enums)}; the contract has only ${PIP_MODE_ENUM}`,
    );
  }
  const modes = shape.enums.find((e) => e.name === PIP_MODE_ENUM);
  if (modes && !same(modes.values, PIP_MODES)) {
    problems.push(
      `${PIP_MODE_ENUM}'s values are ${list(modes.values)}; the contract's are ${list(PIP_MODES)}`,
    );
  }
  return problems;
}
