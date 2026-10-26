import type { EventEnvelope } from "@quest/contract";
import { act, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PipModel } from "../../pip/contract";
import { envelope } from "../../test/events";
import { Command } from "../components/Command";
import { LOCAL_EVENTS } from "../live/events";
import { Pip } from "./Pip";
import { HINT_UNUSED_MS } from "./help";
import {
  PipStageProvider,
  useHelpShowing,
  usePipInput,
  usePipModel,
  usePipStep,
} from "./PipStage";

/** The director's model, as text the test reads. */
function Probe() {
  const model = usePipModel();
  return <output data-testid="model">{JSON.stringify(model)}</output>;
}
const current = (): PipModel =>
  JSON.parse(screen.getByTestId("model").textContent) as PipModel;

function Go({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        void navigate(to);
      }}
    >
      {`go ${to}`}
    </button>
  );
}

function stageAt(path: string, extra: ReactNode = null) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PipStageProvider>
        <Probe />
        {extra}
        <Routes>
          <Route path="/" element={<Go to="/lesson/b-1/step" />} />
          <Route
            path="/lesson/:id/step"
            element={
              <>
                <Pip size="beside" />
                <Go to="/journey" />
              </>
            }
          />
          <Route path="/journey" element={<Go to="/" />} />
        </Routes>
      </PipStageProvider>
    </MemoryRouter>,
  );
}

/** One batch through the page's local source, delivered once claimed. */
async function dispatch(...events: EventEnvelope[]) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent(LOCAL_EVENTS, { detail: events }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

describe("Pip's stage in the app", () => {
  test("greets on Welcome, at the hero size", () => {
    stageAt("/");
    expect(current()).toMatchObject({
      size: "hero",
      reaction: { id: "greeting", kind: "greeting" },
    });
  });

  test("follows the screen", () => {
    stageAt("/");
    act(() => {
      screen.getByRole("button", { name: "go /lesson/b-1/step" }).click();
    });
    expect(current().size).toBe("beside");
  });

  test("events from the page's local source reach the director, each ID once", async () => {
    stageAt("/lesson/b-1/step");
    const passed = envelope({ type: "check.passed", firstTime: true });
    await dispatch(passed);
    expect(current().reaction).toEqual({
      id: passed.id,
      kind: "success",
      intensity: 1,
    });
    const wrong = envelope({ type: "answer.wrong" });
    await dispatch(wrong);
    expect(current().reaction?.id).toBe(wrong.id);
    // passed again: dropped, so wrong is still the Reaction.
    await dispatch(passed);
    expect(current().reaction?.id).toBe(wrong.id);
  });

  test("Thinking runs from check.started to the Check's result", async () => {
    stageAt("/lesson/b-1/step");
    await dispatch(envelope({ type: "check.started" }));
    expect(current().mode).toBe("thinking");
    await dispatch(
      envelope({ type: "check.notYet", evidence: "No commit yet" }),
    );
    expect(current()).toMatchObject({
      mode: "idle",
      reaction: { kind: "retry", intensity: 0.5 },
    });
  });

  test("reduced motion, from the Settings choice on <html>, rests Pip at his resting gaze", async () => {
    stageAt("/lesson/b-1/step");
    expect(current()).toMatchObject({ mode: "idle", reducedMotion: false });
    await act(async () => {
      document.documentElement.dataset.motion = "reduce";
      // MutationObserver records arrive as a microtask.
      await Promise.resolve();
    });
    expect(current()).toMatchObject({
      mode: "rest",
      reducedMotion: true,
      gaze: { x: 0.4, y: 0 },
    });
  });

  test("rests while the page is hidden", () => {
    stageAt("/lesson/b-1/step");
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(current().mode).toBe("rest");
    visibility.mockRestore();
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(current().mode).toBe("idle");
  });

  test("rests while the lesson page panel is open", () => {
    function Panel() {
      const tell = usePipInput();
      const [open, setOpen] = useState(false);
      return (
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            tell({ type: "pagePanel", open: !open });
          }}
        >
          panel
        </button>
      );
    }
    stageAt("/lesson/b-1/step", <Panel />);
    act(() => {
      screen.getByRole("button", { name: "panel" }).click();
    });
    expect(current().mode).toBe("rest");
    act(() => {
      screen.getByRole("button", { name: "panel" }).click();
    });
    expect(current().mode).toBe("idle");
  });

  test("Copy turns Pip's gaze to the command, then back to rest", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this.hasAttribute("data-pip")) return new DOMRect(0, 0, 76, 76);
        if (this.getAttribute("data-pip-target") === "command")
          return new DOMRect(338, 338, 0, 0);
        return new DOMRect();
      },
    );
    stageAt("/lesson/b-1/step", <Command text="git status" />);
    expect(current().gaze).toEqual({ x: 0.4, y: 0 });
    await act(async () => {
      screen.getByRole("button", { name: "Copy git status" }).click();
      await Promise.resolve();
    });
    const gaze = current().gaze;
    expect(gaze?.x).toBeCloseTo(Math.SQRT1_2);
    expect(gaze?.y).toBeCloseTo(Math.SQRT1_2);
    vi.restoreAllMocks();
  });

  test("a screen with no Pip counts as Pip unseen, so its Reactions are dropped", async () => {
    stageAt("/lesson/b-1/step");
    act(() => {
      screen.getByRole("button", { name: "go /journey" }).click();
    });
    expect(current().mode).toBe("rest");
    await dispatch(envelope({ type: "answer.right" }));
    expect(current().reaction).toBeNull();
  });

  test("leaving the step stops its help clock, and coming back starts it afresh", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance", "Date"],
    });
    try {
      function Help() {
        return <output data-testid="help">{String(useHelpShowing())}</output>;
      }
      function Step() {
        usePipStep("b-1:0", true);
        return (
          <>
            <Pip size="beside" />
            <Go to="/journey" />
          </>
        );
      }
      render(
        <MemoryRouter initialEntries={["/lesson/b-1/step"]}>
          <PipStageProvider>
            <Help />
            <Routes>
              <Route path="/lesson/:id/step" element={<Step />} />
              {/* Pip is on the journey too, so an offer could show there. */}
              <Route
                path="/journey"
                element={
                  <>
                    <Pip size="beside" />
                    <Go to="/lesson/b-1/step" />
                  </>
                }
              />
            </Routes>
          </PipStageProvider>
        </MemoryRouter>,
      );
      const showing = () => screen.getByTestId("help").textContent;
      act(() => {
        vi.advanceTimersByTime(HINT_UNUSED_MS / 2);
      });
      act(() => {
        screen.getByRole("button", { name: "go /journey" }).click();
      });
      act(() => {
        vi.advanceTimersByTime(2 * HINT_UNUSED_MS);
      });
      expect(showing()).toBe("false");
      act(() => {
        screen.getByRole("button", { name: "go /lesson/b-1/step" }).click();
      });
      act(() => {
        vi.advanceTimersByTime(HINT_UNUSED_MS - 1000);
      });
      expect(showing()).toBe("false");
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(showing()).toBe("true");
    } finally {
      vi.useRealTimers();
    }
  });
});
