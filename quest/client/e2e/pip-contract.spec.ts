// The Pip contract test: CI never runs the Rive CLI, so this loads the
// committed pip.riv in Chromium, in the web runtime the app ships, with the
// WASM bundled and served from the page's own origin and every other host
// unresolvable, and holds it to the contract (quest/client/pip/contract.ts).
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PIP_CONTRACT } from "../playwright.config.ts";
import {
  PIP_MODES,
  PIP_REACTIONS,
  contractProblems,
  type PipDriver,
  type PipReactionKind,
} from "../pip/contract.ts";
import {
  changedShare,
  drawnBounds,
  eyes,
  headTop,
  soles,
  type Bounds,
  type Rgba,
} from "../pip/png.ts";
import { watch } from "./watch.ts";

async function open(page: Page) {
  await page.goto(PIP_CONTRACT);
  // Polled on a timer, not on animation frames, which stop while the clock is paused.
  await page.waitForFunction(() => window.pip ?? window.pipLoadError, null, {
    timeout: 20_000,
    polling: 100,
  });
  const loadError = await page.evaluate(() => window.pipLoadError ?? null);
  expect(loadError, "the .riv failed to load").toBeNull();
  await installMeasures(page);
}

// Rig time. These pages load with Playwright's clock paused, so Pip advances
// only when a test runs the clock, one 16 ms animation frame at a time: what a
// test sees depends on rig time alone, never on how fast a busy machine draws
// or captures frames.
const FRAME_MS = 16;
const CLOCK_START = new Date("2026-01-01T00:00:00Z").getTime();

async function openPaused(page: Page) {
  await page.clock.install({ time: CLOCK_START });
  await page.clock.pauseAt(CLOCK_START + 1_000);
  await open(page);
}

/** Runs Pip for a whole number of frames. */
async function run(page: Page, frames: number) {
  await page.clock.runFor(frames * FRAME_MS);
}

async function fire(page: Page, reaction: PipReactionKind, intensity?: number) {
  await page.evaluate(
    ([kind, value]) => {
      const pip = window.pip;
      if (!pip) throw new Error("Pip is not loaded");
      if (value !== null) pip.setNumber("intensity", value);
      pip.fire(kind);
    },
    [reaction, intensity ?? null] as const,
  );
}

async function setIntensity(page: Page, value: number) {
  await page.evaluate((v) => window.pip?.setNumber("intensity", v), value);
}

async function setMode(page: Page, mode: (typeof PIP_MODES)[number]) {
  await page.evaluate((m) => window.pip?.setMode(m), mode);
}

async function setGaze(page: Page, x: number, y: number) {
  await page.evaluate(
    ([gx, gy]) => {
      window.pip?.setNumber("gazeX", gx);
      window.pip?.setNumber("gazeY", gy);
    },
    [x, y] as const,
  );
}

async function setReducedMotion(page: Page, value: boolean) {
  await page.evaluate((v) => window.pip?.setReducedMotion(v), value);
}

const shape = (page: Page) =>
  page.evaluate(() => {
    if (!window.pip) throw new Error("Pip is not loaded");
    return window.pip.shape();
  });

// Pip's canvas over the page's white, as the page shows it. Runs in the page.
function grabCanvas(): Rgba {
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error("no canvas");
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const context = copy.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("no 2D context");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, copy.width, copy.height);
  context.drawImage(canvas, 0, 0);
  const { data } = context.getImageData(0, 0, copy.width, copy.height);
  return {
    width: copy.width,
    height: copy.height,
    data: new Uint8Array(data.buffer),
  };
}

/** What a sample measures in each frame: see sampleFrames. */
type SampleKind =
  "bounds" | "head" | "eyes" | "soles" | "step" | "keep" | "none";

/** Playwright's clock in the page: what page.clock.runFor drives. */
interface PageClock {
  controller: {
    runFor(ms: number): Promise<void>;
    fastForward(ms: number): Promise<void>;
  };
}

/**
 * Runs in the page: advances Pip `every` frames, `samples` times, and
 * measures each frame there, so a whole trace is one round trip. "bounds",
 * "eyes" and "soles" are png.ts's measures; "step" is the share of the
 * canvas that changed since the frame before; "keep" keeps each frame as
 * `${name} ${i}` for changedBetween; "none" measures nothing. The clock runs exactly as
 * page.clock.runFor runs it, one 16 ms animation frame after another; with
 * `jump`, as page.clock.fastForward does, so Pip draws one frame per sample
 * and the runtime advances him the whole span at once (its frame time is
 * the clock's, uncapped): for a steady loop, the same pose at a fraction
 * of the cost of drawing every frame in between.
 */
async function sampleFrames(
  samples: number,
  every: number,
  kind: SampleKind,
  name: string,
  jump: boolean,
): Promise<unknown[]> {
  const m = window.pipMeasures;
  const clock = (globalThis as { __pwClock?: PageClock }).__pwClock;
  if (!m) throw new Error("the measures are not installed");
  if (!clock) throw new Error("the page has no Playwright clock");
  const out: unknown[] = [];
  let previous = kind === "step" ? m.grab() : null;
  for (let i = 0; i < samples; i++) {
    if (jump) await clock.controller.fastForward(every * 16);
    else await clock.controller.runFor(every * 16);
    if (kind === "none") continue;
    const image = m.grab();
    if (kind === "bounds") out.push(m.drawnBounds(image));
    else if (kind === "head") out.push(m.headTop(image));
    else if (kind === "eyes") out.push(m.eyes(image));
    else if (kind === "soles") out.push(m.soles(image));
    else if (kind === "step") {
      out.push(previous ? m.changedShare(previous, image) : 0);
      previous = image;
    } else {
      m.kept.set(`${name} ${String(i)}`, image);
      out.push(null);
    }
  }
  return out;
}

/** The frame measures, installed in the page so a sample sends back numbers, never pixels. */
interface PageMeasures {
  grab: typeof grabCanvas;
  changedShare: typeof changedShare;
  drawnBounds: typeof drawnBounds;
  eyes: typeof eyes;
  headTop: typeof headTop;
  soles: typeof soles;
  sample: typeof sampleFrames;
  /** Frames kept by name, to compare with later ones. */
  kept: Map<string, Rgba>;
}

// png.ts's measures are self-contained functions, so their source runs in the
// page as it is. Evaluated by the test's own driver, which the page's Content
// Security Policy does not cover, so the page itself never runs inline script.
const MEASURES = `window.pipMeasures = {
  grab: ${grabCanvas.toString()},
  changedShare: ${changedShare.toString()},
  drawnBounds: ${drawnBounds.toString()},
  eyes: ${eyes.toString()},
  headTop: ${headTop.toString()},
  soles: ${soles.toString()},
  sample: ${sampleFrames.toString()},
  kept: new Map(),
};`;

async function installMeasures(page: Page) {
  await page.evaluate(MEASURES);
}

/** The current frame's size, Pip's drawn box, eyes and soles. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const m = window.pipMeasures;
    if (!m) throw new Error("the measures are not installed");
    const image = m.grab();
    return {
      width: image.width,
      height: image.height,
      bounds: m.drawnBounds(image),
      eyes: m.eyes(image),
      soles: m.soles(image),
    };
  });

/** Keeps the current frame under `name`, in the page. */
const keep = (page: Page, name: string) =>
  page.evaluate((key) => {
    const m = window.pipMeasures;
    if (!m) throw new Error("the measures are not installed");
    m.kept.set(key, m.grab());
  }, name);

/** The share of pixels that differ between two kept frames, or a kept one and the current frame. */
const changed = (page: Page, from: string, to?: string) =>
  page.evaluate(
    ([a, b]) => {
      const m = window.pipMeasures;
      if (!m) throw new Error("the measures are not installed");
      const first = m.kept.get(a);
      const second = b === null ? m.grab() : m.kept.get(b);
      if (!first || !second) throw new Error("no such kept frame");
      return m.changedShare(first, second);
    },
    [from, to ?? null] as const,
  );

/** Runs sampleFrames in the page. */
const sample = (
  page: Page,
  samples: number,
  every: number,
  kind: SampleKind,
  { name = "", jump = false }: { name?: string; jump?: boolean } = {},
) =>
  page.evaluate(
    ([n, e, k, key, j]) => {
      const m = window.pipMeasures;
      if (!m) throw new Error("the measures are not installed");
      return m.sample(n, e, k, key, j);
    },
    [samples, every, kind, name, jump] as const,
  );

/**
 * Lets Pip settle for a whole number of frames, four at a time: back to his
 * mode after a Reaction, or past an ease, before the next measure. The
 * frames in between are never measured, so the runtime need not draw them;
 * it advances Pip by each 64 ms span as it would by four frames.
 */
async function settle(page: Page, frames: number) {
  await sample(page, Math.floor(frames / 4), 4, "none", { jump: true });
  await run(page, frames % 4);
}

/** Pip's drawn box after each of `samples` runs of `every` frames. */
async function boundsTrace(page: Page, samples: number, every: number) {
  const trace = await sample(page, samples, every, "bounds");
  return trace.map((drawn) => {
    if (!drawn) throw new Error("Pip drew nothing");
    return drawn as Bounds;
  });
}

/** Pip's eyes after each of `samples` runs of `every` frames (with `jump`, drawn once per sample). */
async function eyesTrace(
  page: Page,
  samples: number,
  every: number,
  jump = false,
) {
  const trace = await sample(page, samples, every, "eyes", { jump });
  return trace.map((found) => {
    if (!found) throw new Error("Pip's eyes are not drawn");
    return found as NonNullable<ReturnType<typeof eyes>>;
  });
}

/** The largest share of pixels that differ between kept frames `${a} i` and `${b} i`, for i below `count`. */
const changedBetween = (page: Page, a: string, b: string, count: number) =>
  page.evaluate(
    ([first, second, n]) => {
      const m = window.pipMeasures;
      if (!m) throw new Error("the measures are not installed");
      let most = 0;
      for (let i = 0; i < n; i++) {
        const x = m.kept.get(`${first} ${String(i)}`);
        const y = m.kept.get(`${second} ${String(i)}`);
        if (!x || !y) throw new Error("no such kept frame");
        most = Math.max(most, m.changedShare(x, y));
      }
      return most;
    },
    [a, b, count] as const,
  );

/** Pip's eyes in the current frame. */
async function eyesNow(page: Page) {
  const found = (await measure(page)).eyes;
  if (!found) throw new Error("Pip's eyes are not drawn");
  return found;
}

// The whole canvas, sent back to the test: for the few checks the page's
// measures do not cover.
async function frame(page: Page): Promise<Rgba> {
  const { width, height, base64 } = await page.evaluate(() => {
    const m = window.pipMeasures;
    if (!m) throw new Error("the measures are not installed");
    const { width, height, data } = m.grab();
    let binary = "";
    for (let i = 0; i < data.length; i += 0x8000)
      binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { width, height, base64: btoa(binary) };
  });
  return { width, height, data: Buffer.from(base64, "base64") };
}

async function bounds(page: Page): Promise<Bounds> {
  const drawn = (await measure(page)).bounds;
  if (!drawn) throw new Error("Pip drew nothing");
  return drawn;
}

const tops = (trace: readonly Bounds[]) => trace.map((b) => b.top);

/**
 * The top of Pip's head after each of `samples` frames: the measure the
 * hand-over tests compare, which the board's elements round him (Success's
 * strokes, Celebration's confetti) never move, unlike his drawn box.
 */
async function headTrace(page: Page, samples: number) {
  const trace = await sample(page, samples, 1, "head");
  return trace.map((top) => {
    if (typeof top !== "number") throw new Error("Pip's head is not drawn");
    return top;
  });
}

/** The top of Pip's head in the current frame. */
async function headNow(page: Page) {
  const top = await page.evaluate(() => {
    const m = window.pipMeasures;
    if (!m) throw new Error("the measures are not installed");
    return m.headTop(m.grab());
  });
  if (top === null) throw new Error("Pip's head is not drawn");
  return top;
}

test("the committed .riv loads offline with the bundled WASM, and its view model is exactly the contract", async ({
  page,
}) => {
  const seen = watch(page);
  await open(page);
  expect(contractProblems(await shape(page))).toEqual([]);
  expect(await page.evaluate(() => window.pip?.playing())).toBe(true);

  const origin = new URL(PIP_CONTRACT);
  expect(
    seen.requests.filter((url) => url.host !== origin.host).map(String),
  ).toEqual([]);
  // The runtime and the rig came from the page's own build, not a CDN.
  const assets = seen.requests.map((url) => url.pathname);
  expect(
    assets.filter((path) => /^\/assets\/rive-[\w-]+\.wasm$/.test(path)),
  ).toHaveLength(1);
  expect(
    assets.filter((path) => /^\/assets\/pip-[\w-]+\.riv$/.test(path)),
  ).toHaveLength(1);
  expect(seen.problems).toEqual([]);
});

// Each Reaction in a test of its own, so no test runs near its time limit.
for (const reaction of PIP_REACTIONS) {
  test(`${reaction} runs with no error and moves Pip`, async ({ page }) => {
    const seen = watch(page);
    await openPaused(page);

    // How much Pip changes on its own in half a second of Idle (the breath, a blink).
    await settle(page, 38);
    await keep(page, "before");
    await settle(page, 32);
    const drift = await changed(page, "before");

    await keep(page, "rest");
    await fire(page, reaction);
    let moved = 0;
    for (let i = 0; i < 2; i++) {
      await run(page, 16);
      moved = Math.max(moved, await changed(page, "rest"));
    }
    expect(
      moved,
      `${reaction} moves Pip (idle drift ${drift.toFixed(3)})`,
    ).toBeGreaterThan(drift + 0.03);
    expect(seen.problems).toEqual([]);
  });
}

for (const reaction of ["greeting", "curious", "explaining"] as const) {
  test(`${reaction} under reduced motion changes expression without moving Pip`, async ({
    page,
  }) => {
    await openPaused(page);
    await setMode(page, "rest");
    await setReducedMotion(page, true);
    await settle(page, 40);
    const rest = await bounds(page);
    await keep(page, "rest");

    await fire(page, reaction);
    for (const drawn of await boundsTrace(page, 6, 4)) {
      expect(Math.abs(drawn.top - rest.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(drawn.left - rest.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(drawn.right - rest.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(drawn.bottom - rest.bottom)).toBeLessThanOrEqual(1);
    }
    expect(await changed(page, "rest")).toBeGreaterThan(0.005);
  });
}

test("every mode runs with no error, and the other properties take their full ranges", async ({
  page,
}) => {
  const seen = watch(page);
  await openPaused(page);

  for (const mode of [
    ...PIP_MODES.filter((m) => m !== "idle"),
    "idle",
  ] as const) {
    await page.evaluate((m) => window.pip?.setMode(m), mode);
    await settle(page, 32);
    expect(await page.evaluate(() => window.pip?.mode())).toBe(mode);
  }

  await page.evaluate(() => {
    const pip = window.pip;
    if (!pip) throw new Error("Pip is not loaded");
    pip.setNumber("gazeX", 1);
    pip.setNumber("gazeY", -1);
    pip.setNumber("intensity", 0);
    pip.setReducedMotion(true);
    pip.fire("success");
    pip.fire("celebration");
  });
  await settle(page, 50);
  expect(await page.evaluate(() => window.pip?.playing())).toBe(true);
  expect(seen.problems).toEqual([]);
});

test("sleep lies Pip down, and he gets up smoothly when the mode changes", async ({
  page,
}) => {
  test.slow();
  const seen = watch(page);
  await openPaused(page);
  await settle(page, 32);
  const awake = await eyesNow(page);
  const { height } = await measure(page);

  await setMode(page, "sleep");
  await settle(page, 120);
  const asleep = await eyesNow(page);
  expect(asleep.y - awake.y, "asleep: the eyes lie low").toBeGreaterThan(
    height * 0.1,
  );

  // Getting up: the eyes rise over many frames, never more than a quarter
  // of the way in one.
  await setMode(page, "idle");
  const trace = await sample(page, 60, 1, "eyes");
  const ys = [
    asleep.y,
    ...trace.flatMap((found) => (found ? [(found as { y: number }).y] : [])),
  ];
  const travel = asleep.y - Math.min(...ys);
  const steepest = Math.max(
    ...ys.slice(1).map((y, i) => Math.abs(y - (ys[i] ?? y))),
  );
  expect(travel, "awake: the eyes are back up").toBeGreaterThan(height * 0.1);
  expect(steepest, "no jump on the way up").toBeLessThanOrEqual(travel * 0.25);
  expect(seen.problems).toEqual([]);
});

test("under reduced motion Thinking and Sleep hold Rest", async ({ page }) => {
  await openPaused(page);
  await setReducedMotion(page, true);
  await setMode(page, "rest");
  await settle(page, 60);
  await keep(page, "rest");
  for (const mode of ["thinking", "sleep"] as const) {
    await setMode(page, mode);
    await settle(page, 60);
    expect(await changed(page, "rest"), `${mode} holds Rest`).toBeLessThan(
      0.002,
    );
  }
});

test("a Reaction fired again while it plays starts over, and a nod replays Success small", async ({
  page,
}) => {
  test.slow();
  const seen = watch(page);
  await openPaused(page);
  await settle(page, 64);
  const rest = (await bounds(page)).top;

  // Fired again 288 ms in, mid-hop: once the 160 ms hand-over is done, the
  // replay follows the first one frame for frame.
  for (const reaction of ["success", "retry", "celebration"] as const) {
    await fire(page, reaction, 1);
    const first = tops(await boundsTrace(page, 9, 2));
    await fire(page, reaction, 1);
    const again = tops(await boundsTrace(page, 9, 2));
    for (let i = 5; i < first.length; i++) {
      expect(
        Math.abs((again[i] ?? 0) - (first[i] ?? 0)),
        `${reaction} fired again: Pip's top edge ${String((i + 1) * 2 * FRAME_MS)} ms in`,
      ).toBeLessThanOrEqual(2);
    }
  }

  // The nod: Success again at intensity 0.2 while a full one plays. It lifts
  // Pip, and less than the full hop does.
  await settle(page, 96);
  await fire(page, "success", 1);
  const full = Math.min(...tops(await boundsTrace(page, 14, 2)));
  await fire(page, "success", 0.2);
  const nod = Math.min(...tops(await boundsTrace(page, 20, 2)).slice(4));
  expect(rest - nod, "the nod lifts Pip").toBeGreaterThan(3);
  expect(
    nod - full,
    "the nod lifts Pip less than a full Success",
  ).toBeGreaterThan(3);
  expect(seen.problems).toEqual([]);
});

for (const [playing, next] of [
  ["success", "retry"],
  ["celebration", "success"],
  ["success", "success"],
] as const) {
  test(`${next} interrupting ${playing} blends in from Pip's pose, never from rest`, async ({
    page,
  }) => {
    test.slow();
    await openPaused(page);
    await settle(page, 64);

    // The new Reaction on its own, from Idle: where it starts, and how fast it
    // moves Pip by itself.
    await fire(page, next, 1);
    const alone = await headTrace(page, 14);
    await settle(page, 120);

    // The same Reaction fired 288 ms into another, near the top of its hop.
    await fire(page, playing, 1);
    await run(page, 18);
    const from = await headNow(page);
    await fire(page, next, 1);
    const handOver = await headTrace(page, 14);
    await settle(page, 120);

    const at = `${next} interrupting ${playing}`;
    const gap = Math.abs(from - (alone[0] ?? from));
    expect(gap, `${at}: Pip is mid-hop when it is interrupted`).toBeGreaterThan(
      10,
    );
    const trace = [from, ...handOver];
    const steps = handOver.map((top, i) => Math.abs(top - (trace[i] ?? top)));
    const ownPace = Math.max(
      ...alone.slice(1).map((top, i) => Math.abs(top - (alone[i] ?? top))),
    );
    // A snap to the rest pose would cover the whole gap in the first frame.
    expect(
      steps[0],
      `${at}: the first frame stays near the pose Pip was in (gap ${String(gap)} px)`,
    ).toBeLessThanOrEqual(gap / 4);
    // The 160 ms hand-over moves Pip no faster than the new Reaction moves on its own.
    for (const [i, step] of steps.slice(0, 10).entries()) {
      expect(
        step,
        `${at}: frame ${String(i + 1)} of the hand-over (the Reaction alone moves up to ${String(ownPace)} px a frame)`,
      ).toBeLessThanOrEqual(ownPace + 3);
    }
    // Then the new Reaction plays from its start, as it does on its own.
    for (let i = 11; i < alone.length; i++) {
      expect(
        Math.abs((handOver[i] ?? 0) - (alone[i] ?? 0)),
        `${at}: the top of Pip's head ${String((i + 1) * FRAME_MS)} ms in`,
      ).toBeLessThanOrEqual(2);
    }
  });
}

/** Pip's highest top edge over 42 frames, sampled every third, from now. */
const peak = async (page: Page) =>
  Math.min(...tops(await boundsTrace(page, 14, 3)));

/** How close, in px, a Retry fired into another Reaction tops out to Retry fired alone. */
const RETRY_PEAK_MARGIN = 3;

/**
 * Success and Retry alone, from Idle, at full intensity: how high each lifts
 * Pip over its first 42 frames, past Success's apex.
 */
async function peaksAlone(page: Page) {
  const rest = (await bounds(page)).top;
  await fire(page, "success", 1);
  const success = await peak(page);
  await settle(page, 60);
  await fire(page, "retry", 1);
  const retry = await peak(page);
  await settle(page, 60);
  expect(
    retry - success,
    "Success lifts Pip higher than Retry",
  ).toBeGreaterThan(10);
  // Retry's own startle lifts Pip, so a peak near Retry's is Retry playing,
  // never Pip left at rest.
  expect(
    rest - retry,
    `Retry lifts Pip (rest ${String(rest)}, Retry tops at ${String(retry)})`,
  ).toBeGreaterThan(RETRY_PEAK_MARGIN * 2);
  return { success, retry };
}

test("a Reaction fired while another is still blending in replaces it", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await settle(page, 64);
  const { success, retry } = await peaksAlone(page);

  // Retry fired 3, 5 and 9 frames into Success's 160 ms blend: Retry plays,
  // so Pip never reaches Success's apex and lifts as high as Retry alone
  // does (a Retry dropped back to Idle would never lift him).
  for (const after of [3, 5, 9]) {
    await fire(page, "success", 1);
    await run(page, after);
    await fire(page, "retry", 1);
    const top = await peak(page);
    const at = `Retry ${String(after)} frames into Success (Success alone tops at ${String(success)}, Retry at ${String(retry)}, this at ${String(top)})`;
    expect(top, `${at}: replaces Success`).toBeGreaterThan(success + 10);
    expect(Math.abs(top - retry), `${at}: plays Retry`).toBeLessThanOrEqual(
      RETRY_PEAK_MARGIN,
    );
    await settle(page, 60);
  }
});

test("Success replaces Retry fired into its blend, and as Pip blends back to Idle", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await settle(page, 64);
  const { retry } = await peaksAlone(page);

  // Success fired 5 frames into Retry: Success plays.
  await fire(page, "retry", 1);
  await run(page, 5);
  await fire(page, "success", 1);
  expect(
    await peak(page),
    "Success 5 frames into Retry replaces it",
  ).toBeLessThan(retry - 10);
  await settle(page, 60);

  // Success fired as Retry hands back to Idle (its 200 ms return): Success plays.
  await fire(page, "retry", 1);
  await run(page, 78);
  await fire(page, "success", 1);
  expect(
    await peak(page),
    "Success fired as Pip blends back to Idle plays",
  ).toBeLessThan(retry - 10);
});

test("a new intensity during a Reaction glides the pose over several frames, never jumping it", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);

  for (const reaction of ["success", "celebration"] as const) {
    await setIntensity(page, 1);
    await settle(page, 64);
    await fire(page, reaction);
    const steady = tops(await boundsTrace(page, 36, 1));
    await settle(page, 64);

    // The same Reaction, given intensity 0.2 near the top of the hop.
    await fire(page, reaction);
    const changed = tops(await boundsTrace(page, 18, 1));
    await setIntensity(page, 0.2);
    changed.push(...tops(await boundsTrace(page, 18, 1)));

    // How far the new intensity moves Pip from the steady run, frame by frame.
    const gap = changed.map((top, i) => top - (steady[i] ?? 0));
    const widest = Math.max(...gap.map(Math.abs));
    const sharpest = Math.max(
      ...gap.slice(1).map((g, i) => Math.abs(g - (gap[i] ?? 0))),
    );
    expect(
      widest,
      `${reaction}: the new intensity lowers the hop`,
    ).toBeGreaterThan(6);
    expect(
      sharpest,
      `${reaction}: the change spreads over several frames (largest step ${String(sharpest)} of ${String(widest)} px)`,
    ).toBeLessThanOrEqual(widest / 2);
  }
});

for (const reaction of ["success", "retry", "celebration"] as const) {
  test(`intensity sets how big ${reaction} plays`, async ({ page }) => {
    test.slow();
    await openPaused(page);

    for (const intensity of [0.3, 1]) {
      await setIntensity(page, intensity);
      // Past the intensity's 150 ms ease, and back in Idle.
      await settle(page, 120);
      await fire(page, reaction);
      await sample(page, 12, 3, "keep", {
        name: `${reaction} ${String(intensity)}`,
      });
    }
    const apart = await changedBetween(
      page,
      `${reaction} 0.3`,
      `${reaction} 1`,
      12,
    );
    expect(
      apart,
      `${reaction} at intensity 0.3 and at 1 play differently`,
    ).toBeGreaterThan(0.03);
  });
}

for (const [reaction, intensity] of [
  ["retry", 0.5],
  ["retry", 0.3],
  ["success", 0.2],
  ["celebration", 0.5],
] as const) {
  test(`${reaction} at intensity ${String(intensity)}, as the app fires it, blends in with no one-frame jump`, async ({
    page,
  }) => {
    test.slow();
    await openPaused(page);

    // The share of Pip that changes each frame over the first 16, through the
    // 160 ms blend and past its end. A frame that changes far more than both
    // its neighbours is a snap: the blend's pose jumping when the blend ends.
    await setIntensity(page, intensity);
    await settle(page, 120);
    await fire(page, reaction);
    const steps = (await sample(page, 16, 1, "step")) as number[];
    for (let i = 7; i < 14; i++) {
      const step = steps[i] ?? 0;
      const around = Math.max(steps[i - 1] ?? 0, steps[i + 1] ?? 0);
      expect(
        step,
        `${reaction} at intensity ${String(intensity)}: frame ${String(i + 1)} changes ${(step * 100).toFixed(1)}% of the canvas, its neighbours up to ${(around * 100).toFixed(1)}%`,
      ).toBeLessThanOrEqual(around * 2.5 + 0.005);
    }
  });
}

test("a new gaze turns Pip's eyes over several frames, and so does a release back to the centre", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  // Rest holds still, so only the gaze moves Pip.
  await setMode(page, "rest");
  await settle(page, 40);

  for (const [x, y] of [
    [1, 1],
    [0, 0],
  ] as const) {
    const start = await eyesNow(page);
    await setGaze(page, x, y);
    const trace = [start, ...(await eyesTrace(page, 24, 1))];
    const end = trace.at(-1) ?? start;
    const travel = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = trace
      .slice(1)
      .map((p, i) =>
        Math.hypot(p.x - (trace[i]?.x ?? p.x), p.y - (trace[i]?.y ?? p.y)),
      );
    const moving = steps.filter((step) => step > travel / 100).length;
    const largest = Math.max(...steps);
    const at = `gaze ${String(x)}, ${String(y)}`;
    expect(travel, `${at}: the eyes move`).toBeGreaterThan(4);
    expect(
      moving,
      `${at}: the eyes move over several frames`,
    ).toBeGreaterThanOrEqual(5);
    expect(
      largest,
      `${at}: no frame jumps the eyes (largest step ${largest.toFixed(2)} of ${travel.toFixed(2)} px)`,
    ).toBeLessThanOrEqual(travel / 4);
    // Settled at the end: the last frames hold still.
    expect(steps.slice(-6).every((step) => step < 0.05)).toBe(true);
  }
});

/**
 * The eyes' horizontal spread, from the outer edge of one to the outer edge
 * of the other: the darkest pixels in the canvas's top 60%, above the arms.
 */
function eyeSpread(image: Rgba): number {
  let left = image.width;
  let right = -1;
  for (let y = 0; y < Math.floor(image.height * 0.6); y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const sum =
        (image.data[i] ?? 255) +
        (image.data[i + 1] ?? 255) +
        (image.data[i + 2] ?? 255);
      if (sum >= 3 * 48) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return right - left;
}

test("gazeX turns Pip's head: the face slides toward the gaze and narrows as it turns away, both ways", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  // Rest holds still, so only the gaze moves Pip.
  await setMode(page, "rest");
  await settle(page, 40);

  const at: Record<string, { x: number; spread: number; drawn: Bounds }> = {};
  for (const x of [0, 1, -1]) {
    await setGaze(page, x, 0);
    await settle(page, 30);
    const image = await frame(page);
    const drawn = drawnBounds(image);
    const centre = eyes(image);
    if (!drawn || !centre) throw new Error("Pip is not drawn");
    at[String(x)] = { x: centre.x, spread: eyeSpread(image), drawn };
  }
  const [ahead, right, left] = [at["0"], at["1"], at["-1"]];
  if (!ahead || !right || !left) throw new Error("missing a gaze");
  const width = ahead.drawn.right - ahead.drawn.left;
  // The face rides the front plane round toward the gaze...
  expect(right.x - ahead.x).toBeGreaterThan(width * 0.12);
  expect(ahead.x - left.x).toBeGreaterThan(width * 0.12);
  // ...and foreshortens as it turns away: a turn, not a slide.
  expect(right.spread).toBeLessThan(ahead.spread * 0.8);
  expect(left.spread).toBeLessThan(ahead.spread * 0.8);
  // The two turns mirror each other about the front view.
  expect(Math.abs(right.x - ahead.x - (ahead.x - left.x))).toBeLessThan(
    width * 0.05,
  );
});

test("the gaze starts toward a new pointer position promptly and settles within 150 ms", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await setMode(page, "rest");
  await settle(page, 40);
  await setGaze(page, 0, 0);
  await settle(page, 30);
  const ahead = (await measure(page)).eyes;
  if (!ahead) throw new Error("Pip's eyes are not drawn");

  await setGaze(page, 1, 0);
  await run(page, 4);
  const early = (await measure(page)).eyes;
  if (!early) throw new Error("Pip's eyes are not drawn after 64 ms");
  await run(page, 6);
  const settled = (await measure(page)).eyes;
  if (!settled) throw new Error("Pip's eyes are not drawn after 160 ms");

  const distance = settled.x - ahead.x;
  expect(distance).toBeGreaterThan(10);
  expect((early.x - ahead.x) / distance).toBeGreaterThan(0.45);
  await run(page, 4);
  const later = (await measure(page)).eyes;
  if (!later) throw new Error("Pip's eyes are not drawn after 224 ms");
  expect(Math.abs(later.x - settled.x)).toBeLessThanOrEqual(1);
});

/** Connected dark shapes in the face: two eyes and the mouth below them. */
function faceParts(
  image: Rgba,
): { top: number; bottom: number; area: number }[] {
  const { width, height } = image;
  const rows = Math.floor(height * 0.8);
  const seen = new Uint8Array(width * rows);
  const parts: { top: number; bottom: number; area: number }[] = [];
  const dark = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return (
      (image.data[i] ?? 255) +
        (image.data[i + 1] ?? 255) +
        (image.data[i + 2] ?? 255) <
      3 * 80
    );
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (seen[start] || !dark(x, y)) continue;
      const stack = [start];
      seen[start] = 1;
      let top = y;
      let bottom = y;
      let area = 0;
      while (stack.length > 0) {
        const at = stack.pop() ?? 0;
        const px = at % width;
        const py = Math.floor(at / width);
        area++;
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= rows) continue;
            const next = ny * width + nx;
            if (!seen[next] && dark(nx, ny)) {
              seen[next] = 1;
              stack.push(next);
            }
          }
        }
      }
      if (area >= 2) parts.push({ top, bottom, area });
    }
  }
  return parts;
}

const TOP_FACE = [252, 178, 124] as const;
const UNDERSIDE = [180, 70, 31] as const;

/** Pixels of one head plane, proving which way the compiled rig pitches. */
function colourPixels(image: Rgba, colour: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if (
      colour.every(
        (channel, k) => Math.abs((image.data[i + k] ?? 0) - channel) <= 8,
      )
    )
      count++;
  }
  return count;
}

test("gazeY nods Pip's head both ways, and the diagonal poses keep his face readable", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await setMode(page, "rest");
  await settle(page, 40);
  await setGaze(page, 0, 0);
  await settle(page, 30);
  const level = await frame(page);
  const levelEyes = eyes(level);
  if (!levelEyes) throw new Error("Pip's eyes are not drawn");
  const at: Record<
    string,
    { x: number; y: number; topFace: number; underside: number }
  > = {};

  for (const [x, y] of [
    [0, 1],
    [0, -1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    await setGaze(page, x, y);
    await settle(page, 30);
    const image = await frame(page);
    const centre = eyes(image);
    if (!centre) throw new Error("Pip's eyes are not drawn");
    at[`${String(x)},${String(y)}`] = {
      ...centre,
      topFace: colourPixels(image, TOP_FACE),
      underside: colourPixels(image, UNDERSIDE),
    };
    expect(
      changedShare(level, image),
      `gaze ${String(x)}, ${String(y)} moves the whole head`,
    ).toBeGreaterThan(0.05);
    expect(
      eyeSpread(image),
      `gaze ${String(x)}, ${String(y)} keeps two eyes apart`,
    ).toBeGreaterThan(0);
    const parts = faceParts(image);
    expect(
      parts.length,
      `gaze ${String(x)}, ${String(y)} keeps two eyes and the mouth visible`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      parts.some((part) => part.bottom - part.top > 4),
      `gaze ${String(x)}, ${String(y)} keeps the eyes open`,
    ).toBe(true);
  }
  expect(at["0,1"]?.y).toBeGreaterThan(levelEyes.y + 2);
  expect(at["0,-1"]?.y).toBeLessThan(levelEyes.y - 2);
  expect(at["0,1"]?.topFace).toBeGreaterThan(0);
  expect(at["0,-1"]?.underside).toBeGreaterThan(0);
});

test("on Welcome the pointer pitches the rendered head in every direction and eases it without a jump", async ({
  page,
}) => {
  test.slow();
  await page.clock.install();
  await page.goto("/");
  await expect
    .poll(
      async () => {
        await page.clock.runFor(100);
        return page.locator("[data-pip]").getAttribute("data-pip-rendering");
      },
      { timeout: 20_000 },
    )
    .toBe("rig");
  await installMeasures(page);
  const box = await page.locator("[data-pip]").boundingBox();
  if (!box) throw new Error("Pip has no box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.clock.runFor(3_000);
  await settle(page, 30);
  await keep(page, "level");

  for (const [dx, dy] of [
    [0, -120],
    [0, 180],
    [-320, -120],
    [320, -120],
    [-320, 180],
    [320, 180],
  ] as const) {
    await page.mouse.move(cx + dx, cy + dy);
    await settle(page, 30);
    expect(await changed(page, "level")).toBeGreaterThan(0.05);
    const image = await frame(page);
    if (dy < 0) expect(colourPixels(image, UNDERSIDE)).toBeGreaterThan(0);
    else expect(colourPixels(image, TOP_FACE)).toBeGreaterThan(0);
  }

  await page.mouse.move(cx, cy);
  await settle(page, 30);
  await page.mouse.move(cx, cy + 180);
  const steps = (await sample(page, 24, 1, "step")) as number[];
  expect(steps.filter((step) => step > 0.001).length).toBeGreaterThanOrEqual(5);
  expect(Math.max(...steps)).toBeLessThanOrEqual(0.15);
});

/**
 * Pip's eyes across one 12 s Idle loop, every twelfth frame (a glance holds
 * about 0.9 s), the rig drawn once per sample.
 */
async function idleLoop(page: Page) {
  return (await eyesTrace(page, 63, 12, true)).map((found) => found.x);
}

test("in Idle Pip glances left and right on his own, around the gaze he is given", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await setGaze(page, 0.4, 0);
  await settle(page, 30);

  // Pip at rest, before Idle's first glance; then every twelfth frame (a
  // glance holds about 0.9 s) through one 12 s Idle loop.
  const rest = (await eyesNow(page)).x;
  const { width } = await measure(page);
  const xs = await idleLoop(page);
  const left = Math.max(0, ...xs.map((x) => rest - x));
  const right = Math.max(0, ...xs.map((x) => x - rest));
  expect(left, "a glance to the left").toBeGreaterThan(width * 0.03);
  expect(right, "a glance to the right").toBeGreaterThan(width * 0.03);
});

test("in Idle under reduced motion Pip holds his head still", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await setGaze(page, 0.4, 0);
  await setReducedMotion(page, true);
  await settle(page, 40);
  const still = await idleLoop(page);
  expect(
    Math.max(...still) - Math.min(...still),
    "under reduced motion the head holds still",
  ).toBeLessThan(0.5);
});

// The eyes' smallest and largest drawn area over 3.4 s, sampled every other
// frame (a blink lasts 10 frames) with the rig drawn once per sample: longer
// than the widest gap between two blinks, 193 frames across the Blink loop's
// end.
async function eyeArea(page: Page) {
  const areas = (await eyesTrace(page, 105, 2, true)).map(
    (found) => found.pixels,
  );
  return { least: Math.min(...areas), most: Math.max(...areas) };
}

test("Pip blinks while awake", async ({ page }) => {
  // About 8 s in a full parallel e2e run (measured 2026-10-27).
  test.setTimeout(60_000);
  await openPaused(page);
  await run(page, 16);
  const awake = await eyeArea(page);
  expect(awake.least, "Idle: Pip blinks").toBeLessThan(awake.most * 0.5);
});

test("Pip holds its eyes open in Rest and under reduced motion, and blinks again once awake", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await setMode(page, "rest");
  await run(page, 16);
  const resting = await eyeArea(page);
  expect(resting.least, "Rest: the eyes stay open").toBeGreaterThan(
    resting.most * 0.95,
  );

  await setMode(page, "idle");
  await setReducedMotion(page, true);
  await run(page, 16);
  const reduced = await eyeArea(page);
  expect(reduced.least, "reduced motion: the eyes stay open").toBeGreaterThan(
    reduced.most * 0.95,
  );

  await setReducedMotion(page, false);
  await run(page, 16);
  const again = await eyeArea(page);
  expect(again.least, "awake again: Pip blinks again").toBeLessThan(
    again.most * 0.5,
  );
});

for (const reaction of PIP_REACTIONS) {
  test(`Pip stays inside its frame through ${reaction} at full intensity`, async ({
    page,
  }) => {
    test.slow();
    await openPaused(page);
    await settle(page, 64);
    const { width, height } = await measure(page);
    // The artboard clips what it draws, so a part reaching the canvas edge is cut off.
    const margin = 2;

    // Each Reaction through to its end (none runs past 1.6 s), sampled every
    // other frame.
    await fire(page, reaction, 1);
    const trace = await boundsTrace(page, 50, 2);
    for (const [i, drawn] of trace.entries()) {
      const at = `${reaction}, ${String((i + 1) * 2 * FRAME_MS)} ms in`;
      expect(drawn.top, `${at}: room above`).toBeGreaterThanOrEqual(margin);
      expect(drawn.left, `${at}: room on the left`).toBeGreaterThanOrEqual(
        margin,
      );
      expect(drawn.right, `${at}: room on the right`).toBeLessThan(
        width - margin,
      );
      expect(drawn.bottom, `${at}: room below`).toBeLessThan(height - margin);
    }
  });
}

// Each Reaction that leans, through to its end at both intensities, in a
// test of its own: a lean rocks Pip onto one foot, so neither foot ever sinks
// below the floor.
for (const reaction of [
  "retry",
  "greeting",
  "curious",
  "explaining",
] as const) {
  test(`Pip's feet stay on the floor through ${reaction}'s lean`, async ({
    page,
  }) => {
    test.slow();
    await openPaused(page);
    await settle(page, 64);
    const floor = (await measure(page)).soles;
    if (floor === null) throw new Error("Pip's feet are not drawn");

    for (const intensity of [0, 1]) {
      await fire(page, reaction, intensity);
      // Sampled every other frame: a lean's lowest point lasts several.
      const trace = await sample(page, 50, 2, "soles");
      for (const [i, sole] of trace.entries()) {
        expect(
          sole,
          `${reaction} at intensity ${String(intensity)}, ${String((i + 1) * 2 * FRAME_MS)} ms in`,
        ).toBeLessThanOrEqual(floor);
      }
      await settle(page, 60);
    }
  });
}

test("the contract check fails on a .riv whose property was renamed", async ({
  page,
}) => {
  // The committed file with gazeX renamed in place to gazeQ (same length, so
  // the file stays well formed), served instead of the real one.
  const riv = readFileSync(join(import.meta.dirname, "../pip/pip.riv"));
  const name = Buffer.from("gazeX");
  const at = riv.indexOf(name);
  expect(at).toBeGreaterThan(-1);
  expect(riv.indexOf(name, at + 1)).toBe(-1);
  const mutated = Buffer.from(riv);
  mutated.write("gazeQ", at, "latin1");
  await page.route(/\/assets\/pip-[\w-]+\.riv$/, (route) =>
    route.fulfill({ body: mutated, contentType: "application/octet-stream" }),
  );

  await open(page);
  const problems = contractProblems(await shape(page));
  expect(problems).toContain("Pip has no property gazeX");
  expect(problems).toContain(
    "Pip has a property gazeQ the contract does not name",
  );
});

declare global {
  interface Window {
    pip?: PipDriver;
    pipLoadError?: string;
    pipMeasures?: PageMeasures;
  }
}
