import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PipModel } from "../../pip/contract";
import { expectStylesFromTokens } from "../../test/token-classes";
import { REACTION_POSTER_MS, reactionLedger } from "./playback";
import { PipRenderer } from "./PipRenderer";
import type { PipRiveProps } from "./PipRive";
import type { PipRuntime } from "./runtime";

// The runtime is the browser's (WebGL2, WASM); here a stand-in store settles
// when the test says, and a stand-in adapter reports what the renderer asks
// of it.
const runtime = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    settled: undefined as PipRuntime | null | undefined,
    load: vi.fn<() => Promise<PipRuntime | null>>(),
    props: [] as PipRiveProps[],
    draws: true,
    listeners,
    settle(next: PipRuntime | null | undefined) {
      state.settled = next;
      for (const listener of [...listeners]) listener();
    },
  };
  return state;
});
vi.mock("./runtime", () => ({
  settledPipRuntime: () => runtime.settled,
  subscribePipRuntime: (listener: () => void) => {
    runtime.listeners.add(listener);
    return () => {
      runtime.listeners.delete(listener);
    };
  },
  loadPipRuntime: () => {
    const loading = runtime.load();
    void loading.then((loaded) => {
      runtime.settle(loaded);
    });
    return loading;
  },
}));

function FakeRive(props: PipRiveProps) {
  runtime.props.push(props);
  const { onDrawn } = props;
  useEffect(() => {
    if (runtime.draws) onDrawn();
  }, [onDrawn]);
  return <canvas aria-hidden="true" />;
}

const fakeRuntime: PipRuntime = {
  PipRive: FakeRive,
  file: {} as PipRiveProps["file"],
};

const model = (fields: Partial<PipModel> = {}): PipModel => ({
  mode: "idle",
  reaction: null,
  gaze: null,
  restingGaze: { x: 0, y: 0 },
  reducedMotion: false,
  size: "beside",
  ...fields,
});

const pipOf = (container: HTMLElement) => {
  const el = container.querySelector<HTMLElement>("[data-pip]");
  if (!el) throw new Error("no Pip");
  return el;
};
const poster = (container: HTMLElement, pose: string) =>
  container.querySelector<HTMLImageElement>(`img[data-pip-poster=${pose}]`);

beforeEach(() => {
  runtime.settled = undefined;
  runtime.listeners.clear();
  runtime.load.mockReset();
  runtime.props = [];
  runtime.draws = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Pip's renderer", () => {
  test("paints the poster for the current mode at once, decorative, at its size", () => {
    runtime.load.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<PipRenderer model={model()} />);
    const pip = pipOf(container);
    expect(pip).toHaveAttribute("aria-hidden", "true");
    expect(pip).toHaveAttribute("data-pip", "beside");
    expect(pip).toHaveAttribute("data-pip-rendering", "poster");
    expect(pip.className).toContain("size-19");
    expectStylesFromTokens(pip.className);
    const idle = poster(container, "idle");
    expect(idle?.getAttribute("src")).toMatch(/idle-beside/);
    expect(idle).toHaveAttribute("alt", "");
    expect(idle?.className).toContain("opacity-100");
    expect(container.querySelector("canvas")).toBeNull();
  });

  test("the hero size is the hero poster in a 208 px box", () => {
    runtime.load.mockReturnValue(new Promise(() => undefined));
    const { container } = render(
      <PipRenderer model={model({ size: "hero" })} />,
    );
    expect(pipOf(container).className).toContain("size-52");
    expect(poster(container, "idle")?.getAttribute("src")).toMatch(/idle-hero/);
  });

  test("the icon size is the static SVG, and never loads the runtime", async () => {
    const { container } = render(
      <PipRenderer model={model({ size: "icon" })} />,
    );
    expect(container.querySelector("svg[data-pip-icon]")).not.toBeNull();
    expect(container.querySelector("[data-pip], img, canvas")).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(runtime.load).not.toHaveBeenCalled();
  });

  test("loads the runtime only after the first paint", async () => {
    runtime.load.mockReturnValue(new Promise(() => undefined));
    render(<PipRenderer model={model()} />);
    expect(runtime.load).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(runtime.load).toHaveBeenCalledTimes(1);
    });
  });

  test("hands over to the rig once it has drawn, fading the poster out", async () => {
    runtime.load.mockResolvedValue(fakeRuntime);
    const { container } = render(<PipRenderer model={model()} />);
    await waitFor(() => {
      expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
    });
    expect(poster(container, "idle")?.className).toContain("opacity-0");
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas?.parentElement?.className).toContain("opacity-100");
    expect(runtime.props.at(-1)).toMatchObject({
      model: model(),
      active: true,
    });
  });

  test("lets a Reaction start only once the rig's fade over the poster has ended", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    runtime.settled = fakeRuntime;
    const getComputed = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      const style = getComputed(el);
      if (el.querySelector("canvas") && !el.hasAttribute("data-pip"))
        return Object.assign(style, {
          transitionDuration: "0.22s",
          transitionDelay: "0s",
        });
      return style;
    });
    const { container } = render(<PipRenderer model={model()} />);
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
    expect(runtime.props.at(-1)?.handedOver).toBe(false);
    act(() => {
      vi.advanceTimersByTime(219);
    });
    expect(runtime.props.at(-1)?.handedOver).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(runtime.props.at(-1)?.handedOver).toBe(true);
    vi.restoreAllMocks();
  });

  test("hands over when the fades the browser runs have finished, however long past their length", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    runtime.settled = fakeRuntime;
    const { promise: finished, resolve: finish } =
      Promise.withResolvers<undefined>();
    // jsdom runs no transitions: these run until the test finishes them, as
    // a fade a busy page started late would.
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [{ finished } as unknown as Animation],
    });
    try {
      render(<PipRenderer model={model()} />);
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      expect(runtime.props.at(-1)?.handedOver).toBe(false);
      await act(async () => {
        finish(undefined);
        await finished;
      });
      expect(runtime.props.at(-1)?.handedOver).toBe(true);
    } finally {
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  });

  test("on a hidden page, which runs no fades, the fade's own length times the hand-over", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    runtime.settled = fakeRuntime;
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [{ finished: new Promise(() => undefined) }],
    });
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    try {
      render(<PipRenderer model={model()} />);
      expect(runtime.props.at(-1)?.handedOver).toBe(false);
      act(() => {
        vi.runAllTimers();
      });
      expect(runtime.props.at(-1)?.handedOver).toBe(true);
    } finally {
      visibility.mockRestore();
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  });

  test("keeps the poster while the rig has not drawn yet", async () => {
    runtime.draws = false;
    runtime.load.mockResolvedValue(fakeRuntime);
    const { container } = render(<PipRenderer model={model()} />);
    await waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "poster");
    expect(
      container.querySelector("canvas")?.parentElement?.className,
    ).toContain("opacity-0");
    expect(poster(container, "idle")?.className).toContain("opacity-100");
  });

  test("keeps the poster at Pip's resting turn while the gaze moves, and the rig waiting behind it rests there too", async () => {
    runtime.draws = false;
    runtime.load.mockResolvedValue(fakeRuntime);
    const rest = { x: 0.4, y: 0 };
    const at = (x: number) => model({ gaze: { x, y: 0 }, restingGaze: rest });
    const { container, rerender } = render(<PipRenderer model={at(0.4)} />);
    await waitFor(() => {
      expect(container.querySelector("canvas")).not.toBeNull();
    });
    // The pointer, a glance and a look, either side of the turns' midpoint.
    for (const x of [-0.6, 0.1, 0.3, 0.19, 0.21, -1, 0.4]) {
      rerender(<PipRenderer model={at(x)} />);
      expect(pipOf(container)).toHaveAttribute(
        "data-pip-gaze",
        `${x.toFixed(2)} 0.00`,
      );
      const posters = [...container.querySelectorAll("img")];
      expect(posters.map((img) => img.dataset.pipPosterTurn)).toEqual([
        "content",
      ]);
      expect(posters[0]?.className).toContain("opacity-100");
    }
    expect(new Set(runtime.props.map((props) => props.heldGazeX))).toEqual(
      new Set([0.4]),
    );
  });

  test("with the gaze resting where it looks, as the Playground sets it, the poster faces that way", () => {
    runtime.load.mockReturnValue(new Promise(() => undefined));
    const set = (x: number) =>
      model({ gaze: { x, y: 0 }, restingGaze: { x, y: 0 } });
    const { container, rerender } = render(<PipRenderer model={set(0.4)} />);
    const turn = () =>
      container.querySelector<HTMLImageElement>("img.opacity-100")?.dataset
        .pipPosterTurn;
    expect(turn()).toBe("content");
    rerender(<PipRenderer model={set(-0.5)} />);
    expect(turn()).toBe("front");
  });

  test("keeps the poster for good when the runtime is unavailable", async () => {
    runtime.load.mockResolvedValue(null);
    const { container } = render(<PipRenderer model={model()} />);
    await waitFor(() => {
      expect(pipOf(container)).toHaveAttribute(
        "data-pip-rendering",
        "unavailable",
      );
    });
    expect(poster(container, "idle")?.className).toContain("opacity-100");
    expect(container.querySelector("canvas")).toBeNull();
  });

  test("with the rig switched off, keeps the poster for good; back on, the poster shows until the rig draws", () => {
    runtime.settled = fakeRuntime;
    const { container, rerender } = render(<PipRenderer model={model()} />);
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");

    rerender(<PipRenderer model={model()} rig={false} />);
    expect(pipOf(container)).toHaveAttribute(
      "data-pip-rendering",
      "unavailable",
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(poster(container, "idle")?.className).toContain("opacity-100");

    runtime.draws = false;
    rerender(<PipRenderer model={model()} />);
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "poster");
    expect(poster(container, "idle")?.className).toContain("opacity-100");
    act(() => {
      runtime.props.at(-1)?.onDrawn();
    });
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
    expect(runtime.load).not.toHaveBeenCalled();
  });

  test("brings the poster back when the rig fails after loading", async () => {
    runtime.load.mockResolvedValue(fakeRuntime);
    const { container } = render(<PipRenderer model={model()} />);
    await waitFor(() => {
      expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
    });
    act(() => {
      runtime.props.at(-1)?.onFailed();
    });
    expect(pipOf(container)).toHaveAttribute(
      "data-pip-rendering",
      "unavailable",
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(poster(container, "idle")?.className).toContain("opacity-100");
  });

  test("a Pip mounting after the runtime settled draws the rig without loading again", async () => {
    runtime.settled = fakeRuntime;
    const { container } = render(<PipRenderer model={model()} />);
    await waitFor(() => {
      expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
    });
    expect(runtime.load).not.toHaveBeenCalled();
  });

  test("shows a Reaction's poster while it holds, then crossfades back to the mode's", () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    runtime.load.mockReturnValue(new Promise(() => undefined));
    const reacting = model({
      reaction: { id: "renderer.success", kind: "success", intensity: 1 },
    });
    const { container } = render(<PipRenderer model={reacting} />);
    expect(poster(container, "happy")?.className).toContain("opacity-100");
    expect(pipOf(container)).toHaveAttribute(
      "data-pip-reaction",
      "renderer.success",
    );

    act(() => {
      vi.advanceTimersByTime(REACTION_POSTER_MS);
    });
    // Both stay, so the change of pose fades rather than cuts.
    expect(poster(container, "happy")?.className).toContain("opacity-0");
    expect(poster(container, "idle")?.className).toContain("opacity-100");
    expect(pipOf(container)).not.toHaveAttribute("data-pip-reaction");
    for (const img of container.querySelectorAll("img"))
      expect(img.className).toContain("transition-opacity");
  });

  test("passes the model to the rig, and the Reactions it starts show on the element", async () => {
    runtime.load.mockResolvedValue(fakeRuntime);
    const reacting = model({
      mode: "thinking",
      reaction: { id: "renderer.retry", kind: "retry", intensity: 0.5 },
    });
    const { container } = render(<PipRenderer model={reacting} />);
    await waitFor(() => {
      expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
    });
    expect(runtime.props.at(-1)?.model).toEqual(reacting);
    expect(pipOf(container)).not.toHaveAttribute("data-pip-reaction");
    act(() => {
      runtime.props.at(-1)?.onReaction("renderer.retry");
    });
    expect(pipOf(container)).toHaveAttribute(
      "data-pip-reaction",
      "renderer.retry",
    );
  });

  test("tells the rig to pause while the page is hidden", async () => {
    runtime.load.mockResolvedValue(fakeRuntime);
    render(<PipRenderer model={model()} />);
    await waitFor(() => {
      expect(runtime.props.at(-1)?.active).toBe(true);
    });
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(runtime.props.at(-1)?.active).toBe(false);
    visibility.mockRestore();
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(runtime.props.at(-1)?.active).toBe(true);
  });

  test("fades back to the poster when the rig's context is lost, and back to the rig when a new runtime is running", async () => {
    runtime.load.mockResolvedValue(fakeRuntime);
    const { container } = render(<PipRenderer model={model()} />);
    await waitFor(() => {
      expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
    });

    act(() => {
      runtime.settle(null);
    });
    expect(pipOf(container)).toHaveAttribute(
      "data-pip-rendering",
      "unavailable",
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(poster(container, "idle")?.className).toContain("opacity-100");

    // The runtime starting again: the poster holds until the new rig draws.
    runtime.draws = false;
    act(() => {
      runtime.settle(undefined);
    });
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "poster");
    const restarted: PipRuntime = {
      PipRive: FakeRive,
      file: {} as PipRiveProps["file"],
    };
    act(() => {
      runtime.settle(restarted);
    });
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "poster");
    expect(runtime.props.at(-1)?.file).toBe(restarted.file);
    act(() => {
      runtime.props.at(-1)?.onDrawn();
    });
    expect(pipOf(container)).toHaveAttribute("data-pip-rendering", "rig");
  });

  test("a Reaction that comes while Pip shows its poster for good is spent, so a rig that comes back never replays it", async () => {
    runtime.load.mockResolvedValue(null);
    const reacting = model({
      reaction: { id: "renderer.spent", kind: "success", intensity: 1 },
    });
    const { container } = render(<PipRenderer model={reacting} />);
    await waitFor(() => {
      expect(pipOf(container)).toHaveAttribute(
        "data-pip-rendering",
        "unavailable",
      );
    });
    expect(reactionLedger.start("renderer.spent")).toBe(false);
  });

  test("a Reaction that comes while the runtime loads is left for the rig to start", () => {
    runtime.load.mockReturnValue(new Promise(() => undefined));
    render(
      <PipRenderer
        model={model({
          reaction: { id: "renderer.waits", kind: "greeting", intensity: 1 },
        })}
      />,
    );
    expect(reactionLedger.start("renderer.waits")).toBe(true);
  });
});
