import { act, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
  vi,
} from "vitest";
import {
  PIP_REACTIONS,
  type PipModel,
  type PipReactionKind,
} from "../../pip/contract";
import {
  closeRig,
  GAZE_SETTLE_MS,
  openRig,
  PipRive,
  type PipRiveProps,
} from "./PipRive";

// Rive's React runtime, faked: each view model property records what the
// adapter writes into it, in order, and each trigger records that it fired.
const rive = vi.hoisted(() => {
  const writes: [name: string, value: unknown][] = [];
  const setters = new Map<string, (value: unknown) => void>();
  /** One setter per property, the same on every render, as Rive's hooks give. */
  const setter = (name: string) => {
    let set = setters.get(name);
    if (set === undefined) {
      set = (value: unknown) => {
        writes.push([name, value]);
      };
      setters.set(name, set);
    }
    return set;
  };
  const loader = {
    setWasmUrl: vi.fn<(url: string) => void>(),
    setWasmFallbackUrl: vi.fn<(url: string | null) => void>(),
    setWasmBinary: vi.fn<(wasm: ArrayBuffer | null) => void>(),
    awaitInstance: vi.fn<() => Promise<unknown>>(),
    runtime: null as unknown,
    isLoading: false,
  };
  return {
    writes,
    setter,
    loader,
    /** Whether the view model's properties have resolved. */
    bound: true,
    instance: {
      play: vi.fn(),
      pause: vi.fn(),
      startRendering: vi.fn(),
    },
    files: [] as { options: unknown; cleanup: () => void }[],
  };
});

vi.mock("@rive-app/react-webgl2", () => {
  class RiveFile {
    cleanup = vi.fn();
    constructor(options: unknown) {
      rive.files.push({ options, cleanup: this.cleanup });
    }
    init() {
      return Promise.resolve();
    }
    getInstance() {
      return {};
    }
  }
  const property = (name: string) => ({ setValue: rive.setter(name) });
  return {
    RiveFile,
    RuntimeLoader: rive.loader,
    useRive: () => ({
      rive: rive.instance,
      setCanvasRef: () => undefined,
      setContainerRef: () => undefined,
    }),
    useViewModel: () => ({}),
    useViewModelInstance: () => ({}),
    useViewModelInstanceEnum: (name: string) => ({
      values: rive.bound ? ["idle", "thinking", "rest"] : [],
      ...property(name),
    }),
    useViewModelInstanceNumber: property,
    useViewModelInstanceBoolean: property,
    useViewModelInstanceTrigger: (name: string) => ({
      trigger: rive.setter(`trigger:${name}`),
    }),
  };
});

const model = (fields: Partial<PipModel> = {}): PipModel => ({
  mode: "idle",
  reaction: null,
  gaze: null,
  restingGaze: { x: 0, y: 0 },
  reducedMotion: false,
  size: "beside",
  ...fields,
});

function props(fields: Partial<PipRiveProps> = {}): PipRiveProps {
  return {
    file: {} as PipRiveProps["file"],
    model: model(),
    active: true,
    handedOver: true,
    heldGazeX: 0,
    onDrawn: vi.fn(),
    onFailed: vi.fn(),
    onReaction: vi.fn(),
    ...fields,
  };
}

/** The writes and triggers, by property name, in order. */
const written = (...names: string[]) =>
  rive.writes.filter(([name]) => names.includes(name));
const fired = () =>
  rive.writes
    .filter(([name]) => name.startsWith("trigger:"))
    .map(([name]) => name.slice("trigger:".length));

beforeEach(() => {
  rive.writes.length = 0;
  rive.bound = true;
  rive.files.length = 0;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Pip's Rive adapter", () => {
  test("writes nothing until the view model binds, then the mode, gaze and reduced motion", () => {
    rive.bound = false;
    const { rerender } = render(
      <PipRive {...props({ model: model({ mode: "thinking" }) })} />,
    );
    expect(rive.writes).toEqual([]);
    rive.bound = true;
    rerender(<PipRive {...props({ model: model({ mode: "thinking" }) })} />);
    expect(written("mode")).toEqual([["mode", "thinking"]]);
    // A null gaze is the centre, where the rig's own glances play.
    expect(written("gazeX", "gazeY")).toEqual([
      ["gazeX", 0],
      ["gazeY", 0],
    ]);
    expect(written("reducedMotion")).toEqual([["reducedMotion", false]]);
  });

  test("follows the model: the mode, the gaze clamped to -1..1, and reduced motion", () => {
    const { rerender } = render(<PipRive {...props()} />);
    rive.writes.length = 0;
    rerender(
      <PipRive
        {...props({
          model: model({
            mode: "rest",
            gaze: { x: 2, y: -0.5 },
            reducedMotion: true,
          }),
        })}
      />,
    );
    expect(written("mode")).toEqual([["mode", "rest"]]);
    expect(written("gazeX", "gazeY")).toEqual([
      ["gazeX", 1],
      ["gazeY", -0.5],
    ]);
    expect(written("reducedMotion")).toEqual([["reducedMotion", true]]);
  });

  test("holds the poster's turn until it has taken over, then eases to the model's gaze", () => {
    // On Progress the director's glance toward the goal (0.94, 0.34) can
    // come before the rig takes over from the poster, turned 0.4.
    const glance = model({ gaze: { x: 0.94, y: 0.34 } });
    const { rerender } = render(
      <PipRive
        {...props({ model: glance, handedOver: false, heldGazeX: 0.4 })}
      />,
    );
    expect(written("gazeX", "gazeY")).toEqual([
      ["gazeX", 0.4],
      ["gazeY", 0],
    ]);
    rive.writes.length = 0;
    rerender(
      <PipRive
        {...props({ model: glance, handedOver: true, heldGazeX: 0.4 })}
      />,
    );
    expect(written("gazeX", "gazeY")).toEqual([
      ["gazeX", 0.94],
      ["gazeY", 0.34],
    ]);
  });

  test("sets a Reaction's intensity before it fires the trigger, and reports the start", () => {
    const onReaction = vi.fn();
    render(
      <PipRive
        {...props({
          model: model({
            reaction: { id: "rive.order", kind: "retry", intensity: 0.5 },
          }),
          onReaction,
        })}
      />,
    );
    expect(written("intensity", "trigger:retry")).toEqual([
      ["intensity", 0.5],
      ["trigger:retry", undefined],
    ]);
    expect(onReaction).toHaveBeenCalledExactlyOnceWith("rive.order");
  });

  test.each(PIP_REACTIONS)("a %s Reaction fires its own trigger", (kind) => {
    render(
      <PipRive
        {...props({
          model: model({
            reaction: { id: `rive.kind.${kind}`, kind, intensity: 1 },
          }),
        })}
      />,
    );
    expect(fired()).toEqual([kind]);
  });

  test("starts each Reaction once, also on a Pip that mounts after it", () => {
    const reaction = {
      id: "rive.once",
      kind: "success" as PipReactionKind,
      intensity: 1,
    };
    const onReaction = vi.fn();
    const first = render(
      <PipRive {...props({ model: model({ reaction }), onReaction })} />,
    );
    first.rerender(
      <PipRive
        {...props({ model: model({ reaction, mode: "thinking" }), onReaction })}
      />,
    );
    first.unmount();
    render(<PipRive {...props({ model: model({ reaction }), onReaction })} />);
    expect(fired()).toEqual(["success"]);
    expect(onReaction).toHaveBeenCalledTimes(1);
  });

  test("a Reaction that came while the view model was still binding starts once it binds", () => {
    rive.bound = false;
    const reaction = {
      id: "rive.waited",
      kind: "greeting" as PipReactionKind,
      intensity: 1,
    };
    const { rerender } = render(
      <PipRive {...props({ model: model({ reaction }) })} />,
    );
    expect(fired()).toEqual([]);
    rive.bound = true;
    rerender(<PipRive {...props({ model: model({ reaction }) })} />);
    expect(fired()).toEqual(["greeting"]);
  });

  test("holds a Reaction until the poster has handed over, then starts it", () => {
    const reaction = {
      id: "rive.handover",
      kind: "greeting" as PipReactionKind,
      intensity: 1,
    };
    const onReaction = vi.fn();
    const { rerender } = render(
      <PipRive
        {...props({
          model: model({ reaction }),
          handedOver: false,
          onReaction,
        })}
      />,
    );
    expect(fired()).toEqual([]);
    expect(onReaction).not.toHaveBeenCalled();
    rerender(
      <PipRive {...props({ model: model({ reaction }), onReaction })} />,
    );
    expect(fired()).toEqual(["greeting"]);
    expect(onReaction).toHaveBeenCalledExactlyOnceWith("rive.handover");
  });

  test("plays while active and pauses otherwise", () => {
    const { rerender } = render(<PipRive {...props()} />);
    expect(rive.instance.play).toHaveBeenCalledTimes(1);
    rerender(<PipRive {...props({ active: false })} />);
    expect(rive.instance.pause).toHaveBeenCalledTimes(1);
  });

  test("reports a frame drawn two animation frames after it starts rendering", () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
    });
    const onDrawn = vi.fn();
    render(<PipRive {...props({ onDrawn })} />);
    expect(rive.instance.startRendering).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(onDrawn).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(onDrawn).toHaveBeenCalledTimes(1);
  });

  test("with a gaze away from the Learner, hands over only once the turn has settled", () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
    });
    const onDrawn = vi.fn();
    render(
      <PipRive
        {...props({
          onDrawn,
          handedOver: false,
          heldGazeX: 0.4,
          model: model({ gaze: { x: 0.4, y: 0 } }),
        })}
      />,
    );
    const frames = Math.ceil(GAZE_SETTLE_MS / 16);
    for (let i = 0; i < frames; i++) {
      act(() => {
        vi.advanceTimersToNextFrame();
      });
    }
    expect(onDrawn).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(onDrawn).toHaveBeenCalledTimes(1);
  });

  test("the canvas is hidden from screen readers", () => {
    const { container } = render(<PipRive {...props()} />);
    expect(container.querySelector("canvas")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("the canvas fills its box from the start, never the browser's default 300 px", () => {
    const { container } = render(<PipRive {...props()} />);
    expect(container.querySelector("canvas")).toHaveClass("size-full");
  });
});

describe("opening the rig", () => {
  /** WebGL2, faked: the runtime's renderer gets one of these from its canvas. */
  class FakeWebGL2 {
    readonly fake = true;
  }

  /** A runtime whose shared renderer asks a new canvas for WebGL2, as Rive's does. */
  function fakeRuntime(make: () => void = () => undefined) {
    return {
      makeRenderer: vi.fn(() => {
        make();
        document.createElement("canvas").getContext("webgl2");
        return {};
      }),
    };
  }

  /** Every canvas gives this for any context it is asked for. */
  function canvasesGive(context: object | null) {
    const proto = HTMLCanvasElement.prototype;
    const before = Object.getOwnPropertyDescriptor(proto, "getContext");
    Object.defineProperty(proto, "getContext", {
      ...before,
      value: () => context,
    });
    onTestFinished(() => {
      if (before !== undefined)
        Object.defineProperty(proto, "getContext", before);
    });
  }

  beforeEach(() => {
    vi.stubGlobal("WebGL2RenderingContext", FakeWebGL2);
  });

  const wasm = new ArrayBuffer(8);
  const riv = new ArrayBuffer(4);

  test("loads the WASM from the app's own URL with no fallback, and the rig with no asset CDN", async () => {
    const context = new FakeWebGL2();
    canvasesGive(context);
    rive.loader.awaitInstance.mockResolvedValue(fakeRuntime());
    const rig = await openRig("/assets/rive.wasm", wasm, riv);
    expect(rive.loader.setWasmUrl).toHaveBeenCalledWith("/assets/rive.wasm");
    expect(rive.loader.setWasmFallbackUrl).toHaveBeenCalledWith(null);
    expect(rive.loader.setWasmBinary).toHaveBeenCalledWith(wasm);
    expect(rive.files.map((file) => file.options)).toEqual([
      { buffer: riv, enableRiveAssetCDN: false },
    ]);
    // The context the runtime's shared renderer drew into, to watch for loss.
    expect(rig?.context).toBe(context);
    // The page's hold on the file goes back when it closes.
    if (rig === null) throw new Error("no rig");
    closeRig(rig);
    expect(rive.files[0]?.cleanup).toHaveBeenCalledTimes(1);
  });

  test("is null, and quiet, when the browser refuses the runtime a WebGL2 context", async () => {
    const error = vi.spyOn(console, "error");
    canvasesGive(null);
    const refusing = fakeRuntime(() => {
      // As Rive's renderer does when its canvas gives it no context.
      throw new Error("Unable to create WebGL context");
    });
    rive.loader.awaitInstance.mockResolvedValue(refusing);
    expect(await openRig("/assets/rive.wasm", wasm, riv)).toBeNull();
    expect(refusing.makeRenderer).toHaveBeenCalledTimes(1);
    expect(rive.files).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });

  test("leaves the canvas's getContext as it found it", async () => {
    const before = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "getContext",
    );
    rive.loader.awaitInstance.mockResolvedValue(
      fakeRuntime(() => {
        throw new Error("no renderer");
      }),
    );
    await openRig("/assets/rive.wasm", wasm, riv);
    expect(
      Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        "getContext",
      ),
    ).toEqual(before);
  });

  test("opened again, after a lost context, it starts a new runtime instance", async () => {
    canvasesGive(new FakeWebGL2());
    rive.loader.awaitInstance.mockResolvedValue(fakeRuntime());
    await openRig("/assets/rive.wasm", wasm, riv);
    rive.loader.runtime = {};
    rive.loader.isLoading = true;
    await openRig("/assets/rive.wasm", wasm, riv);
    expect(rive.loader.runtime).toBeNull();
    expect(rive.loader.isLoading).toBe(false);
  });
});
