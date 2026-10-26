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

/** Pip's eyes in the current frame. */
async function eyesNow(page: Page) {
  const found = eyes(await frame(page));
  if (!found) throw new Error("Pip's eyes are not drawn");
  return found;
}

const shape = (page: Page) =>
  page.evaluate(() => {
    if (!window.pip) throw new Error("Pip is not loaded");
    return window.pip.shape();
  });

// Pip's canvas over the page's white, as the page shows it, read inside the
// page: far quicker than a screenshot, for the tests that follow Pip frame by
// frame.
async function frame(page: Page): Promise<Rgba> {
  const { width, height, base64 } = await page.evaluate(() => {
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
    let binary = "";
    for (let i = 0; i < data.length; i += 0x8000)
      binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { width: copy.width, height: copy.height, base64: btoa(binary) };
  });
  return { width, height, data: Buffer.from(base64, "base64") };
}

async function bounds(page: Page): Promise<Bounds> {
  const drawn = drawnBounds(await frame(page));
  if (!drawn) throw new Error("Pip drew nothing");
  return drawn;
}

/** Pip's drawn box after each of `samples` runs of `every` frames. */
async function boundsTrace(page: Page, samples: number, every: number) {
  const trace: Bounds[] = [];
  for (let i = 0; i < samples; i++) {
    await run(page, every);
    trace.push(await bounds(page));
  }
  return trace;
}

const tops = (trace: readonly Bounds[]) => trace.map((b) => b.top);

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

test("every Reaction and every mode runs with no error, and each Reaction moves Pip", async ({
  page,
}) => {
  test.slow();
  const seen = watch(page);
  await openPaused(page);

  // How much Pip changes on its own in half a second of Idle (the breath, a blink).
  await run(page, 38);
  const before = await frame(page);
  await run(page, 32);
  const drift = changedShare(before, await frame(page));

  for (const reaction of PIP_REACTIONS) {
    const rest = await frame(page);
    await fire(page, reaction);
    let moved = 0;
    for (let i = 0; i < 2; i++) {
      await run(page, 16);
      moved = Math.max(moved, changedShare(rest, await frame(page)));
    }
    expect(
      moved,
      `${reaction} moves Pip (idle drift ${drift.toFixed(3)})`,
    ).toBeGreaterThan(drift + 0.03);
    // Let the Reaction finish and Pip settle back into Idle.
    await run(page, 88);
  }

  for (const mode of [
    ...PIP_MODES.filter((m) => m !== "idle"),
    "idle",
  ] as const) {
    await page.evaluate((m) => window.pip?.setMode(m), mode);
    await run(page, 32);
    expect(await page.evaluate(() => window.pip?.mode())).toBe(mode);
  }

  // The other properties take their full ranges.
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
  await run(page, 50);
  expect(await page.evaluate(() => window.pip?.playing())).toBe(true);
  expect(seen.problems).toEqual([]);
});

test("a Reaction fired again while it plays starts over, and a nod replays Success small", async ({
  page,
}) => {
  test.slow();
  const seen = watch(page);
  await openPaused(page);
  await run(page, 64);
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
  await run(page, 96);
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

test("a Reaction that interrupts another blends in from Pip's pose, never from rest", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await run(page, 64);

  for (const [playing, next] of [
    ["success", "retry"],
    ["celebration", "success"],
    ["success", "success"],
  ] as const) {
    // The new Reaction on its own, from Idle: where it starts, and how fast it
    // moves Pip by itself.
    await fire(page, next, 1);
    const alone = tops(await boundsTrace(page, 14, 1));
    await run(page, 120);

    // The same Reaction fired 288 ms into another, near the top of its hop.
    await fire(page, playing, 1);
    await run(page, 18);
    const from = (await bounds(page)).top;
    await fire(page, next, 1);
    const handOver = tops(await boundsTrace(page, 14, 1));
    await run(page, 120);

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
        `${at}: Pip's top edge ${String((i + 1) * FRAME_MS)} ms in`,
      ).toBeLessThanOrEqual(2);
    }
  }
});

test("a new intensity during a Reaction glides the pose over several frames, never jumping it", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);

  for (const reaction of ["success", "celebration"] as const) {
    await setIntensity(page, 1);
    await run(page, 64);
    await fire(page, reaction);
    const steady = tops(await boundsTrace(page, 36, 1));
    await run(page, 64);

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

test("intensity sets how big Success, Retry and Celebration play", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);

  for (const reaction of ["success", "retry", "celebration"] as const) {
    const runs: Rgba[][] = [];
    for (const intensity of [0.3, 1]) {
      await setIntensity(page, intensity);
      // Past the intensity's 150 ms ease, and back in Idle.
      await run(page, 120);
      await fire(page, reaction);
      const frames: Rgba[] = [];
      for (let i = 0; i < 12; i++) {
        await run(page, 3);
        frames.push(await frame(page));
      }
      runs.push(frames);
    }
    const [soft = [], full = []] = runs;
    const apart = Math.max(
      ...soft.map((f, i) => {
        const g = full[i];
        return g ? changedShare(f, g) : 0;
      }),
    );
    expect(
      apart,
      `${reaction} at intensity 0.3 and at 1 play differently`,
    ).toBeGreaterThan(0.03);
  }
});

test("a new gaze turns Pip's eyes over several frames, and so does a release back to the centre", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  // Rest holds still, so only the gaze moves Pip.
  await setMode(page, "rest");
  await run(page, 40);

  for (const [x, y] of [
    [1, 1],
    [0, 0],
  ] as const) {
    const start = await eyesNow(page);
    await setGaze(page, x, y);
    const trace = [start];
    for (let i = 0; i < 24; i++) {
      await run(page, 1);
      trace.push(await eyesNow(page));
    }
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
    ).toBeLessThanOrEqual(travel / 2);
    // Settled at the end: the last frames hold still.
    expect(steps.slice(-6).every((step) => step < 0.05)).toBe(true);
  }
});

test("Pip blinks while awake, and holds its eyes open in Rest and under reduced motion", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await run(page, 16);

  // The eyes' smallest and largest drawn area over 4.8 s, longer than one
  // blink cycle, sampled every other frame (a blink lasts 10 frames).
  async function eyeArea() {
    const areas: number[] = [];
    for (let i = 0; i < 150; i++) {
      await run(page, 2);
      areas.push((await eyesNow(page)).pixels);
    }
    return { least: Math.min(...areas), most: Math.max(...areas) };
  }

  const awake = await eyeArea();
  expect(awake.least, "Idle: Pip blinks").toBeLessThan(awake.most * 0.5);

  await setMode(page, "rest");
  await run(page, 16);
  const resting = await eyeArea();
  expect(resting.least, "Rest: the eyes stay open").toBeGreaterThan(
    resting.most * 0.95,
  );

  await setMode(page, "idle");
  await setReducedMotion(page, true);
  await run(page, 16);
  const reduced = await eyeArea();
  expect(reduced.least, "reduced motion: the eyes stay open").toBeGreaterThan(
    reduced.most * 0.95,
  );

  await setReducedMotion(page, false);
  await run(page, 16);
  const again = await eyeArea();
  expect(again.least, "awake again: Pip blinks again").toBeLessThan(
    again.most * 0.5,
  );
});

test("Pip stays inside its frame through every Reaction at full intensity", async ({
  page,
}) => {
  test.slow();
  await openPaused(page);
  await run(page, 64);
  const { width, height } = await frame(page);
  // The artboard clips what it draws, so a part reaching the canvas edge is cut off.
  const margin = 2;

  // Each Reaction through to its end (none runs past 1.6 s), sampled every
  // other frame.
  for (const reaction of PIP_REACTIONS) {
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
  }
});

test("Pip's feet stay on the floor through every lean", async ({ page }) => {
  test.slow();
  await openPaused(page);
  await run(page, 64);
  const floor = soles(await frame(page));
  if (floor === null) throw new Error("Pip's feet are not drawn");

  // Each Reaction that leans, through to its end, sampled every other frame: a
  // lean rocks Pip onto one foot, so neither foot ever sinks below the floor.
  for (const reaction of [
    "retry",
    "greeting",
    "curious",
    "explaining",
  ] as const) {
    for (const intensity of [0, 1]) {
      await fire(page, reaction, intensity);
      for (let i = 0; i < 50; i++) {
        await run(page, 2);
        expect(
          soles(await frame(page)),
          `${reaction} at intensity ${String(intensity)}, ${String((i + 1) * 2 * FRAME_MS)} ms in`,
        ).toBeLessThanOrEqual(floor);
      }
      await run(page, 60);
    }
  }
});

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
  }
}
