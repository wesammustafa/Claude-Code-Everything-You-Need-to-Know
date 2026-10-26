// Pip's Rive adapter: the one place that knows Rive's names. It maps the
// PipModel onto the rig's view model by name (the mode enum, one trigger per
// Reaction, intensity, gaze and reducedMotion) through the runtime's
// view model hooks, and never touches a state machine input (deprecated).
// This module and the runtime load only after the page's first paint
// (runtime.ts imports it dynamically), so none of it is on the first screen.
import {
  RiveFile,
  RuntimeLoader,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceBoolean,
  useViewModelInstanceEnum,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
} from "@rive-app/react-webgl2";
import { useEffect, useRef } from "react";
import {
  PIP_ARTBOARD,
  PIP_STATE_MACHINE,
  PIP_VIEW_MODEL,
  type PipModel,
  type PipReactionKind,
} from "../../pip/contract";
import { reactionLedger } from "./playback";
import { rigValues } from "./rig";

/** The rig, open on a runtime, and the WebGL2 context every Pip draws through. */
export interface OpenedRig {
  file: RiveFile;
  /** The runtime's shared offscreen renderer's context, to watch for loss. */
  context: WebGL2RenderingContext;
}

/** The rig's gaze ease (view-model.rml, 220 ms) and a frame's margin. */
export const GAZE_SETTLE_MS = 240;

/** Whether a runtime instance was started before, so the next must be a new one. */
let started = false;

/**
 * Starts a runtime instance from WASM bytes the app fetched from its own
 * origin, makes its shared renderer, and opens the rig. The runtime's URL is
 * set to the same file and its fallback to none, so it never reaches for a
 * CDN; the rig's assets never come from Rive's CDN either. Null when the
 * browser gives the renderer no WebGL2 context; rejects when the runtime or
 * the file fails. Called again after the shared context was lost, it starts
 * a new instance, since the old one can never draw again.
 */
export async function openRig(
  wasmUrl: string,
  wasm: ArrayBuffer,
  riv: ArrayBuffer,
): Promise<OpenedRig | null> {
  if (started) startOver();
  started = true;
  RuntimeLoader.setWasmUrl(wasmUrl);
  RuntimeLoader.setWasmFallbackUrl(null);
  RuntimeLoader.setWasmBinary(wasm);
  const runtime = await RuntimeLoader.awaitInstance();
  const context = makeSharedRenderer(runtime);
  if (context === null) return null;
  const file = new RiveFile({ buffer: riv, enableRiveAssetCDN: false });
  await file.init();
  // The page's own hold on the file: each Pip that draws it takes and gives
  // back one of its own, so the last Pip unmounting never frees it. The page
  // gives its hold back with closeRig.
  file.getInstance();
  return { file, context };
}

/** Gives back the page's hold on the file, once no Pip draws it. */
export function closeRig(rig: OpenedRig): void {
  rig.file.cleanup();
}

/**
 * Lets the next awaitInstance start a new runtime instance. A runtime makes
 * its shared WebGL context once and keeps it, with every program and buffer
 * in it, so after the context is lost it can never draw again, and
 * RuntimeLoader keeps the instance with no way to reset it. Its two private
 * fields that hold the instance are cleared here, by name: those of the
 * pinned @rive-app/webgl2 2.45.1. A version that renames them fails the type
 * check here, and the context-loss e2e test.
 */
function startOver(): void {
  RuntimeLoader["runtime"] = null;
  RuntimeLoader["isLoading"] = false;
}

/**
 * Makes the runtime's shared offscreen renderer now, before any Pip asks for
 * one, and returns the WebGL2 context it drew into. Made here, a context the
 * browser refuses (WebGL2 was there for the probe, and is gone now) is a
 * quiet null; made for the first Pip, the runtime would report it on the
 * console. The runtime keeps the context to itself, so the WebGL2 contexts
 * made during the call are noted as they are made, and the last one is the
 * one it kept.
 */
function makeSharedRenderer(
  runtime: Awaited<ReturnType<typeof RuntimeLoader.awaitInstance>>,
): WebGL2RenderingContext | null {
  const made: WebGL2RenderingContext[] = [];
  const canvas = HTMLCanvasElement.prototype;
  const getContext = Object.getOwnPropertyDescriptor(canvas, "getContext");
  if (getContext === undefined) return null;
  const original: unknown = getContext.value;
  if (typeof original !== "function") return null;
  const noting = function (this: HTMLCanvasElement, ...args: unknown[]) {
    const context: unknown = original.apply(this, args);
    if (context instanceof WebGL2RenderingContext) made.push(context);
    return context;
  };
  Object.defineProperty(canvas, "getContext", { ...getContext, value: noting });
  try {
    // The runtime's proxy for this throwaway canvas is all it returns; the
    // shared renderer it made stays with the runtime for every Pip.
    runtime.makeRenderer(document.createElement("canvas"), true);
  } catch {
    return null;
  } finally {
    Object.defineProperty(canvas, "getContext", getContext);
  }
  return made.at(-1) ?? null;
}

export interface PipRiveProps {
  file: RiveFile;
  model: PipModel;
  /** On screen and the page visible: the rig plays; otherwise it pauses. */
  active: boolean;
  /**
   * The poster has faded out and the rig alone shows Pip, so a Reaction can
   * start: one started during the crossfade would play over the still poster
   * as a double image.
   */
  handedOver: boolean;
  /**
   * The gazeX of the poster the rig takes over from. Until it has taken
   * over, the rig rests there, facing the way the poster faces, so the
   * crossfade joins one pose; then it takes the model's gaze, and a glance
   * the director asked for meanwhile eases in on the live rig.
   */
  heldGazeX: number;
  /** The canvas holds a frame drawn from the model: the poster can go. */
  onDrawn: () => void;
  /** The runtime could not draw this Pip: the poster stays. */
  onFailed: () => void;
  /** The rig started a Reaction. */
  onReaction: (id: string) => void;
}

/** The rig on a canvas, hidden from screen readers: the bubble's text carries the meaning. */
export function PipRive({
  file,
  model,
  active,
  handedOver,
  heldGazeX,
  onDrawn,
  onFailed,
  onReaction,
}: PipRiveProps) {
  const failed = useRef(onFailed);
  useEffect(() => {
    failed.current = onFailed;
  }, [onFailed]);

  const { rive, setCanvasRef, setContainerRef } = useRive(
    {
      riveFile: file,
      artboard: PIP_ARTBOARD,
      stateMachine: PIP_STATE_MACHINE,
      // Plays once the model is applied, and only while Pip can be seen.
      autoplay: false,
      // The view model instance is bound below, by name.
      autoBind: false,
      enableRiveAssetCDN: false,
      // Pip follows no pointer and takes no input.
      shouldDisableRiveListeners: true,
      onLoadError: () => {
        failed.current();
      },
    },
    {
      // Every Pip on a page shares one WebGL context.
      useOffscreenRenderer: true,
      // Pip pauses itself off-screen (below), not only stops drawing.
      shouldUseIntersectionObserver: false,
    },
  );

  const viewModel = useViewModel(rive, { name: PIP_VIEW_MODEL });
  const instance = useViewModelInstance(viewModel, { rive });
  const mode = useViewModelInstanceEnum("mode", instance);
  const intensity = useViewModelInstanceNumber("intensity", instance);
  const gazeX = useViewModelInstanceNumber("gazeX", instance);
  const gazeY = useViewModelInstanceNumber("gazeY", instance);
  const reducedMotion = useViewModelInstanceBoolean("reducedMotion", instance);
  const triggers: Record<PipReactionKind, () => void> = {
    greeting: useViewModelInstanceTrigger("greeting", instance).trigger,
    curious: useViewModelInstanceTrigger("curious", instance).trigger,
    explaining: useViewModelInstanceTrigger("explaining", instance).trigger,
    success: useViewModelInstanceTrigger("success", instance).trigger,
    retry: useViewModelInstanceTrigger("retry", instance).trigger,
    celebration: useViewModelInstanceTrigger("celebration", instance).trigger,
  };
  // The view model's properties have resolved once the mode enum lists its values.
  const bound = mode.values.length > 0;

  const values = rigValues(model);
  const setMode = mode.setValue;
  const setGazeX = gazeX.setValue;
  const setGazeY = gazeY.setValue;
  const setReducedMotion = reducedMotion.setValue;
  useEffect(() => {
    if (bound) setMode(values.mode);
  }, [bound, setMode, values.mode]);
  const gaze = handedOver
    ? { x: values.gazeX, y: values.gazeY }
    : { x: heldGazeX, y: 0 };
  useEffect(() => {
    if (!bound) return;
    setGazeX(gaze.x);
    setGazeY(gaze.y);
  }, [bound, setGazeX, setGazeY, gaze.x, gaze.y]);
  useEffect(() => {
    if (bound) setReducedMotion(values.reducedMotion);
  }, [bound, setReducedMotion, values.reducedMotion]);

  // A Reaction plays once per ID in this tab, at its intensity, set first so
  // the blend opens at the right strength, once the rig has taken over from
  // the poster: the crossfade joins the poster to the rig's resting pose, and
  // the Reaction then plays whole on the rig.
  const reaction = model.reaction;
  const setIntensity = intensity.setValue;
  const fire = triggers[reaction?.kind ?? "greeting"];
  const reacted = useRef(onReaction);
  useEffect(() => {
    reacted.current = onReaction;
  }, [onReaction]);
  useEffect(() => {
    if (!bound || !handedOver || reaction === null) return;
    if (!reactionLedger.start(reaction.id)) return;
    setIntensity(reaction.intensity);
    fire();
    reacted.current(reaction.id);
  }, [bound, handedOver, reaction, setIntensity, fire]);

  // Plays only while Pip can be seen; paused, the state machine stops
  // advancing and the runtime stops drawing.
  useEffect(() => {
    if (rive === null || !bound) return;
    if (active) rive.play();
    else rive.pause();
  }, [rive, bound, active]);

  // Once the model is applied, a frame is drawn on the next animation frame;
  // the one after it is on screen, and the poster can hand over. A turn away
  // from the Learner eases in over the rig's 220 ms from the front view, so
  // then the hand-over also waits for the turn to settle: the rig holds the
  // poster's turn (above), and the crossfade joins the same pose.
  const drawn = useRef(onDrawn);
  const settle = useRef(0);
  const gazeAway = heldGazeX !== 0;
  useEffect(() => {
    drawn.current = onDrawn;
    settle.current = gazeAway ? GAZE_SETTLE_MS : 0;
  }, [onDrawn, gazeAway]);
  useEffect(() => {
    if (rive === null || !bound) return;
    rive.startRendering();
    let frames = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      frames++;
      start ??= now;
      if (frames >= 2 && now - start >= settle.current) {
        drawn.current();
        return;
      }
      pending = requestAnimationFrame(tick);
    };
    let pending = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(pending);
    };
  }, [rive, bound]);

  return (
    <div ref={setContainerRef} className="absolute inset-0">
      {/* Sized by its box from the start: before the runtime sizes it, a bare
          canvas is the browser's 300 by 150, wider than Pip beside the step. */}
      <canvas
        ref={setCanvasRef}
        aria-hidden="true"
        className="block size-full"
      />
    </div>
  );
}
