// Loads Pip's Rive runtime once per page, after the first paint and never in
// the way: the shell, the Lesson and Pip's poster are already on screen, and
// nothing waits for it. Every way it can fail (no WebGL2, the WASM or the
// .riv refused or broken, the runtime unable to start) settles to "no rig",
// and Pip keeps its poster; so does a lost WebGL context, until the browser
// restores it. Nothing it fetches leaves the app's own origin.
import wasmUrl from "@rive-app/webgl2/rive.wasm?url";
import type { ComponentType } from "react";
import buildRecord from "../../pip/build-record.json?raw";
import rivUrl from "../../pip/pip.riv?url";
import type { PipRiveProps } from "./PipRive";

/** What a Pip needs to draw the rig: the adapter component and the loaded file. */
export interface PipRuntime {
  PipRive: ComponentType<PipRiveProps>;
  file: PipRiveProps["file"];
}

/** undefined while loading, null when the rig is unavailable. */
export type SettledPipRuntime = PipRuntime | null | undefined;

let settled: SettledPipRuntime;
let loading: Promise<PipRuntime | null> | undefined;
const listeners = new Set<() => void>();

function settle(runtime: SettledPipRuntime): void {
  settled = runtime;
  for (const listener of [...listeners]) listener();
}

/** The runtime as it stands: loaded, null for unavailable, undefined while loading. */
export function settledPipRuntime(): SettledPipRuntime {
  return settled;
}

/** Called whenever the runtime settles, is lost, or comes back. */
export function subscribePipRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Loads the runtime once; resolves to null when Pip must keep its poster. */
export function loadPipRuntime(): Promise<PipRuntime | null> {
  loading ??= load().then(
    (runtime) => {
      settle(runtime);
      return runtime;
    },
    () => {
      settle(null);
      return null;
    },
  );
  return loading;
}

/**
 * Whether this browser gives a page WebGL2. Probed on a throwaway canvas,
 * whose context is released at once, so a browser without it never fetches
 * the runtime. A browser that refuses the runtime's own context later still
 * keeps the poster quietly: openRig makes that context itself, not the first
 * Pip.
 */
export function webgl2Available(): boolean {
  if (typeof WebGL2RenderingContext === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl === null) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * The sha256 of the rig the build wrote, from Pip's build record (whose test
 * holds it to the committed pip.riv).
 */
const RIG_SHA256: unknown = (
  JSON.parse(buildRecord) as { outputs?: Record<string, unknown> }
).outputs?.["pip.riv"];

/**
 * Whether bytes are the rig the build wrote. A rig that arrived damaged or
 * replaced would make the runtime itself report errors on the console, so it
 * never reaches the runtime. Where the page has no Web Crypto (only outside a
 * secure context, which the app's own origin always is) the check is skipped.
 */
export async function isBuiltRig(riv: ArrayBuffer): Promise<boolean> {
  if (typeof RIG_SHA256 !== "string") return false;
  if (typeof crypto === "undefined" || !("subtle" in crypto)) return true;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", riv));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return hex === RIG_SHA256;
}

/** A same-origin file's bytes, or null when it cannot be had. */
async function bytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

type Adapter = typeof import("./PipRive");

async function load(): Promise<PipRuntime | null> {
  if (!webgl2Available()) return null;
  // The adapter, the WASM and the rig load side by side. Both files are
  // fetched here, not by the runtime, so a refused or broken one is found
  // before the runtime sees it, and the runtime never falls back to another
  // host. The WASM is downloaded whole and then compiled, not compiled as it
  // streams in: the runtime takes either a URL, which it streams and
  // compiles itself with no way to check the file first (a refused or broken
  // one reaches the console), or the bytes, which is what it is given here.
  // It takes no compiled module: RuntimeLoader hands its Emscripten module
  // only locateFile and wasmBinary, never an instantiateWasm hook, so a
  // module from WebAssembly.compileStreaming has no way in.
  const [adapter, wasm, riv] = await Promise.all([
    import("./PipRive"),
    bytes(wasmUrl),
    bytes(rivUrl),
  ]);
  if (wasm === null || riv === null || !WebAssembly.validate(wasm)) return null;
  if (!(await isBuiltRig(riv))) return null;
  return open(adapter, wasm, riv);
}

/**
 * Opens the rig and watches the WebGL context it draws through. When the
 * browser loses that context (a GPU reset, too many contexts on the page)
 * every Pip goes back to its poster at once. When the browser restores it,
 * the runtime starts again and Pip comes back; a rig that has not finished
 * reopening shows its poster meanwhile, as at page load.
 */
async function open(
  adapter: Adapter,
  wasm: ArrayBuffer,
  riv: ArrayBuffer,
): Promise<PipRuntime | null> {
  const rig = await adapter.openRig(wasmUrl, wasm, riv);
  if (rig === null) return null;
  const canvas = rig.context.canvas;
  const lost = (event: Event) => {
    // Asks the browser to restore the context.
    event.preventDefault();
    settle(null);
    adapter.closeRig(rig);
  };
  const restored = () => {
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
    settle(undefined);
    open(adapter, wasm, riv).then(settle, () => {
      settle(null);
    });
  };
  canvas.addEventListener("webglcontextlost", lost, { once: true });
  canvas.addEventListener("webglcontextrestored", restored);
  return { PipRive: adapter.PipRive, file: rig.file };
}
