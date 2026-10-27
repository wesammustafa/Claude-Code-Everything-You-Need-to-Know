// Pip follows the pointer: on Welcome and Lesson complete his gaze follows
// the mouse anywhere, a little each frame, and lets go after 2 s still or
// when the mouse leaves the window; on the step only near him, never over
// the content; never under reduced motion or for touch and pen; and at most
// one gaze change per frame however fast the mouse moves. The gaze is read
// back as the adapter writes it to the rig's view model.
import { expect, test, type Page } from "@playwright/test";
import { STEP, WASM, pip } from "./pip-page.ts";
import { watch } from "./watch.ts";

const FORWARD = "0.00 0.00";
const REST = "0.40 0.00";
const COMPLETE = "/#/lesson/b-1/complete";

/** The gaze the adapter writes to the rig, as numbers. */
async function gaze(page: Page): Promise<[number, number]> {
  const value = (await pip(page).getAttribute("data-pip-gaze")) ?? "";
  const [x = NaN, y = NaN] = value.split(" ").map(Number);
  return [x, y];
}

/** Pip's centre on the page. */
async function centre(page: Page): Promise<{ x: number; y: number }> {
  const box = await pip(page).boundingBox();
  if (box === null) throw new Error("Pip is not on the page");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

type Check = (x: number, y: number) => boolean;

/**
 * Moves the mouse to (dx, dy) from Pip's centre, then keeps it moving a
 * pixel back and forth there until Pip's gaze passes `check`: following
 * waits for a Reaction playing (Welcome's Greeting) to finish.
 */
async function pointTo(page: Page, dx: number, dy: number, check: Check) {
  const c = await centre(page);
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 6 });
  let nudge = 0;
  await expect
    .poll(
      async () => {
        nudge = 1 - nudge;
        await page.mouse.move(c.x + dx + nudge, c.y + dy);
        return check(...(await gaze(page)));
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

const LEFT: Check = (x, y) => x < -0.25 && Math.abs(y) < 0.1;
const RIGHT: Check = (x, y) => x > 0.25 && Math.abs(y) < 0.1;
const ABOVE: Check = (x, y) => y < -0.25 && Math.abs(x) < 0.1;
const BELOW: Check = (x, y) => y > 0.25 && Math.abs(x) < 0.1;

/** Every gaze the adapter writes from now on, with the time it was written. */
async function noteGazes(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector("[data-pip]");
    const gazes: { at: number; value: string }[] = [];
    Object.assign(window, { gazes });
    if (el === null) return;
    new MutationObserver(() => {
      gazes.push({
        at: performance.now(),
        value: el.getAttribute("data-pip-gaze") ?? "",
      });
    }).observe(el, { attributeFilter: ["data-pip-gaze"] });
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { gazes: { at: number; value: string }[] }).gazes,
    );
}

/** Mouse moves sent by the page itself, as the browser sends them. */
async function synthetic(
  page: Page,
  x: number,
  y: number,
  pointerType: string,
) {
  await page.evaluate(
    ([px, py, type]) => {
      const target = document.elementFromPoint(px, py) ?? document.body;
      target.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: px,
          clientY: py,
          pointerType: type,
          bubbles: true,
        }),
      );
    },
    [x, y, pointerType] as const,
  );
}

for (const [name, path] of [
  ["Welcome", "/"],
  ["Lesson complete", COMPLETE],
] as const) {
  test.describe(name, () => {
    test("the gaze follows the mouse left, right, above and below Pip", async ({
      page,
    }) => {
      const seen = watch(page);
      await page.goto(path);
      await expect(pip(page)).toHaveAttribute("data-pip", "hero");
      await expect(pip(page)).toHaveAttribute("data-pip-gaze", FORWARD);
      await pointTo(page, -320, 0, LEFT);
      await pointTo(page, 320, 0, RIGHT);
      // Welcome's Pip sits near the window's top: above him, inside it.
      const { y } = await centre(page);
      await pointTo(page, 0, -Math.min(180, y - 8), ABOVE);
      await pointTo(page, 0, 180, BELOW);
      expect(seen.problems).toEqual([]);
    });

    test("a mouse gliding past Pip moves the gaze a little each frame, with no jump", async ({
      page,
    }) => {
      await page.goto(path);
      await pointTo(page, -400, 0, LEFT);
      // One move per animation frame, 6 px apart, from his left to his
      // right, and the gaze the adapter writes on each frame.
      const trace = await page.evaluate(async () => {
        const el = document.querySelector("[data-pip]");
        if (el === null) throw new Error("no Pip");
        const box = el.getBoundingClientRect();
        const y = box.y + box.height / 2;
        const from = box.x + box.width / 2 - 400;
        const values: string[] = [];
        for (let x = from; x <= from + 800; x += 6) {
          (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(
            new PointerEvent("pointermove", {
              clientX: x,
              clientY: y,
              pointerType: "mouse",
              bubbles: true,
            }),
          );
          await new Promise(requestAnimationFrame);
          values.push(el.getAttribute("data-pip-gaze") ?? "");
        }
        await new Promise(requestAnimationFrame);
        values.push(el.getAttribute("data-pip-gaze") ?? "");
        return values;
      });
      const xs = trace.map((value) => Number(value.split(" ")[0]));
      expect(xs[0]).toBeLessThan(-0.4);
      expect(xs.at(-1)).toBeGreaterThan(0.4);
      const steps = xs.slice(1).map((x, i) => Math.abs(x - (xs[i] ?? x)));
      // A step's worth, even when two frames' changes land in one.
      expect(Math.max(...steps)).toBeLessThanOrEqual(0.1);
      // Through the middle, every value between: no jump across Pip.
      expect(new Set(xs).size).toBeGreaterThan(60);
    });

    test("2 seconds still releases the gaze", async ({ page }) => {
      await page.goto(path);
      // When the mouse last moved, as the page heard it.
      await page.evaluate(() => {
        window.addEventListener("pointermove", () => {
          Object.assign(window, { lastMove: performance.now() });
        });
      });
      await pointTo(page, -320, 0, LEFT);
      const gazes = await noteGazes(page);
      await expect(pip(page)).toHaveAttribute("data-pip-gaze", FORWARD, {
        timeout: 5_000,
      });
      const lastMove = await page.evaluate(
        () => (window as unknown as { lastMove: number }).lastMove,
      );
      const released = (await gazes()).find((g) => g.value === FORWARD);
      expect(released).toBeDefined();
      const after = (released?.at ?? 0) - lastMove;
      expect(after).toBeGreaterThan(1_950);
      expect(after).toBeLessThan(2_600);
    });

    test("leaving the window releases the gaze", async ({ page }) => {
      await page.goto(path);
      await pointTo(page, -320, 0, LEFT);
      const gazes = await noteGazes(page);
      const start = await page.evaluate(() => performance.now());
      // Out past the window's top edge.
      const c = await centre(page);
      await page.mouse.move(c.x - 320, -20, { steps: 4 });
      await expect(pip(page)).toHaveAttribute("data-pip-gaze", FORWARD);
      const released = (await gazes()).find((g) => g.value === FORWARD);
      expect((released?.at ?? Infinity) - start).toBeLessThan(1_000);
    });

    test("at most one gaze change per frame, however fast the mouse moves", async ({
      page,
    }) => {
      await page.goto(path);
      await pointTo(page, -320, 0, LEFT);
      const { changes, frames } = await page.evaluate(async () => {
        const el = document.querySelector("[data-pip]");
        if (el === null) throw new Error("no Pip");
        const box = el.getBoundingClientRect();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        let frame = 0;
        let counting = true;
        const count = () => {
          frame++;
          if (counting) requestAnimationFrame(count);
        };
        requestAnimationFrame(count);
        const changed: number[] = [];
        // Every change, each its own record, with the frame it came in.
        const observer = new MutationObserver((records) => {
          changed.push(...records.map(() => frame));
        });
        observer.observe(el, { attributeFilter: ["data-pip-gaze"] });
        // A move in a task of its own, many tasks a frame, for 400 ms.
        const channel = new MessageChannel();
        const end = performance.now() + 400;
        let i = 0;
        await new Promise<void>((resolve) => {
          channel.port1.onmessage = () => {
            i++;
            const angle = i / 7;
            const x = cx + Math.cos(angle) * 320;
            const y = cy + Math.sin(angle) * 120;
            (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(
              new PointerEvent("pointermove", {
                clientX: x,
                clientY: y,
                pointerType: "mouse",
                bubbles: true,
              }),
            );
            if (performance.now() < end) channel.port2.postMessage(null);
            else resolve();
          };
          channel.port2.postMessage(null);
        });
        await new Promise(requestAnimationFrame);
        counting = false;
        observer.disconnect();
        return { changes: changed, frames: frame };
      });
      expect(changes.length).toBeGreaterThan(5);
      expect(new Set(changes).size).toBe(changes.length);
      expect(changes.length).toBeLessThanOrEqual(frames);
    });
  });
}

test("on Welcome the gaze reaches the rig: Pip's eyes turn toward the pointer", async ({
  page,
}) => {
  test.slow();
  // Rig time, as in the contract test: the page's clock is paused, so Pip
  // advances only as the test runs it, 16 ms a frame.
  const FRAME_MS = 16;
  await page.clock.install();
  await page.goto("/");
  await expect
    .poll(
      async () => {
        await page.clock.runFor(100);
        return pip(page).getAttribute("data-pip-rendering");
      },
      { timeout: 20_000 },
    )
    .toBe("rig");
  // On Pip, in the dead zone, until the Greeting has played and he settles.
  const c = await centre(page);
  await page.mouse.move(c.x, c.y);
  await page.clock.runFor(3_000);
  await expect(pip(page)).toHaveAttribute("data-pip-gaze", FORWARD);

  // Where his eyes are drawn: the centre of the canvas's dark pixels, read
  // over white as pip/png.ts's eyes() reads them.
  const canvas = pip(page).locator("canvas");
  const eyesX = () =>
    canvas.evaluate((el: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = el.width;
      copy.height = el.height;
      const context = copy.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("no 2D context");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, copy.width, copy.height);
      context.drawImage(el, 0, 0);
      const { data } = context.getImageData(0, 0, copy.width, copy.height);
      let sum = 0;
      let pixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const shade = (data[i] ?? 255) + (data[i + 1] ?? 255);
        if (shade + (data[i + 2] ?? 255) >= 3 * 48) continue;
        sum += (i / 4) % copy.width;
        pixels++;
      }
      if (pixels === 0) throw new Error("Pip's eyes are not drawn");
      return sum / pixels;
    });

  // The mouse jumps far to his left in one move. How the rig eases each
  // frame is the contract test's to pin, on the rig alone: drawn through the
  // app's shared canvas under load, frames can arrive together.
  const start = await eyesX();
  await page.mouse.move(c.x - 400, c.y);
  for (let i = 0; i < 24; i++) await page.clock.runFor(FRAME_MS);
  await expect(pip(page)).not.toHaveAttribute("data-pip-gaze", FORWARD);
  expect(
    start - (await eyesX()),
    "the eyes turn to Pip's left",
  ).toBeGreaterThan(2);
});

test.describe("the step", () => {
  test("no following while the mouse is over the content; following when it comes near Pip", async ({
    page,
  }) => {
    const seen = watch(page);
    await page.goto(STEP);
    const card = await page.locator("main article").boundingBox();
    if (card === null) throw new Error("no step card");
    // The mouse starts at the window's corner: onto the card first.
    await page.mouse.move(card.x + 60, card.y + 60);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    const gazes = await noteGazes(page);
    // Over the step card and over Pip's bubble, and between them, moving all
    // the while. Into each straight down or up from where the mouse is, so
    // the way from the card to the bubble stays clear of the ring around Pip
    // where he follows.
    let y = card.y + 60;
    for (const content of [
      page.locator("main article"),
      page.locator("main [role=status][aria-live=polite]"),
    ]) {
      const box = await content.boundingBox();
      if (box === null) throw new Error("no content");
      await page.mouse.move(box.x + 20, y, { steps: 3 });
      for (let i = 0; i < 6; i++) {
        y = box.y + 20 + i * 4;
        await page.mouse.move(box.x + 20 + i * 12, y, { steps: 3 });
        await page.waitForTimeout(60);
      }
    }
    expect((await gazes()).map((g) => g.value)).toEqual([]);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);

    // In the margin to Pip's left, near him: he follows.
    await pointTo(page, -120, 0, LEFT);
    // Back over the content: he lets go at once.
    await page.mouse.move(card.x + 60, card.y + 60, { steps: 4 });
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    expect(seen.problems).toEqual([]);
  });

  test("a hand wobbling across the column's edge, or the edge of Pip's reach, barely moves him", async ({
    page,
  }) => {
    await page.goto(STEP);
    const main = await page.locator("main").boundingBox();
    if (main === null) throw new Error("no main");
    const box = await pip(page).boundingBox();
    if (box === null) throw new Error("Pip is not on the page");
    // Each edge from the side where Pip rests: over the column, out of reach.
    // The column's edge below him, past the ring around him where he follows.
    const below = box.y + box.height + 40;
    for (const [edge, from, top] of [
      [main.x, 40, below],
      [box.x - 200, -40, box.y],
    ] as const) {
      await page.mouse.move(edge + from, top);
      await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
      const gazes = await noteGazes(page);
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(edge + 6 * Math.sin(i * 1.7), top + i * 8);
        await page.waitForTimeout(16);
      }
      for (const { value } of await gazes()) {
        const [x = NaN, y = NaN] = value.split(" ").map(Number);
        expect(Math.abs(x - 0.4), value).toBeLessThanOrEqual(0.1);
        expect(Math.abs(y), value).toBeLessThanOrEqual(0.1);
      }
    }
  });

  test("a hand wobbling across Pip's own edges, or the column's edge beside him, turns him only a little each move", async ({
    page,
  }) => {
    await page.goto(STEP);
    await pointTo(page, -120, 0, LEFT);
    // Pip's left, top, right and bottom edges, and the column's edge level
    // with him: each crossed back and forth 3 px either way, one move per
    // animation frame, and the gaze the adapter writes on each frame.
    const traces = await page.evaluate(async () => {
      const el = document.querySelector("[data-pip]");
      const main = document.querySelector("main");
      if (el === null || main === null) throw new Error("no Pip or main");
      const box = el.getBoundingClientRect();
      const column = main.getBoundingClientRect();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const move = (x: number, y: number) => {
        (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(
          new PointerEvent("pointermove", {
            clientX: x,
            clientY: y,
            pointerType: "mouse",
            bubbles: true,
          }),
        );
      };
      const edges = [
        [box.x, cy, 1, 0],
        [cx, box.y, 0, 1],
        [box.right, cy, 1, 0],
        [cx, box.bottom, 0, 1],
        [column.x, cy, 1, 0],
      ] as const;
      const traces: { edge: string; values: string[] }[] = [];
      for (const [x, y, dx, dy] of edges) {
        const values: string[] = [];
        for (let i = 0; i < 30; i++) {
          const d = 3 * Math.sin(i * 1.7);
          move(x + d * dx, y + d * dy);
          await new Promise(requestAnimationFrame);
          values.push(el.getAttribute("data-pip-gaze") ?? "");
        }
        traces.push({ edge: `${String(x)}, ${String(y)}`, values });
      }
      return traces;
    });
    for (const { edge, values } of traces) {
      const gazes = values.map((value) => value.split(" ").map(Number));
      // From the first frame on the edge: getting there may turn him more.
      for (let i = 1; i < gazes.length; i++) {
        const [x = NaN, y = NaN] = gazes[i] ?? [];
        const [px = NaN, py = NaN] = gazes[i - 1] ?? [];
        expect(
          Math.hypot(x - px, y - py),
          `${values.join(" | ")} at ${edge}`,
        ).toBeLessThanOrEqual(0.1);
      }
    }
  });

  test("while the runtime loads, a hand near Pip moves his gaze but never turns his poster", async ({
    page,
  }) => {
    // The runtime's WASM held back: Pip shows his poster all the while.
    const { promise: released, resolve: release } =
      Promise.withResolvers<undefined>();
    await page.route(WASM, async (route) => {
      await released;
      await route.continue().catch(() => undefined);
    });
    await page.goto(STEP);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);
    // Every turn the visible poster shows from now on.
    await page.evaluate(() => {
      const el = document.querySelector("[data-pip]");
      const turns: string[] = [];
      Object.assign(window, { posterTurns: turns });
      const note = () => {
        for (const img of el?.querySelectorAll("img") ?? [])
          if (img.classList.contains("opacity-100"))
            turns.push(img.dataset.pipPosterTurn ?? "");
      };
      note();
      if (el !== null)
        new MutationObserver(note).observe(el, {
          subtree: true,
          childList: true,
          attributeFilter: ["class"],
        });
    });
    const gazes = await noteGazes(page);
    // Near him on his left, then hovering at the edge of his reach, where
    // the gaze crosses back and forth between his two poster turns.
    await pointTo(page, -120, 0, LEFT);
    const c = await centre(page);
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(c.x - 203 - 25 * Math.sin(i / 2), c.y);
      await page.waitForTimeout(30);
    }
    const xs = (await gazes()).map((g) => Number(g.value.split(" ")[0]));
    expect(xs.some((x) => x < 0.2)).toBe(true);
    expect(xs.some((x) => x > 0.2 && x < 0.4)).toBe(true);
    await expect(pip(page)).toHaveAttribute("data-pip-rendering", "poster");
    const turns = await page.evaluate(
      () => (window as unknown as { posterTurns: string[] }).posterTurns,
    );
    expect(new Set(turns)).toEqual(new Set(["content"]));
    release(undefined);
  });

  test("scrolling under a still mouse lets go at once, well before the 2 s release", async ({
    page,
  }) => {
    // Short enough that the step scrolls.
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto(STEP);
    await pointTo(page, -120, 0, LEFT);
    const started = Date.now();
    await page.mouse.wheel(0, 160);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST, {
      timeout: 1500,
    });
    expect(Date.now() - started).toBeLessThan(1500);
  });

  test("far from Pip, off the content, there is no following either; near him there is", async ({
    page,
  }) => {
    await page.goto(STEP);
    const c = await centre(page);
    // Below him in the margin, 400 px down: well over 200 px from his box.
    await page.mouse.move(c.x - 120, c.y + 400);
    const gazes = await noteGazes(page);
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(c.x - 120 - i * 4, c.y + 400 + i * 6, {
        steps: 3,
      });
      await page.waitForTimeout(60);
    }
    expect((await gazes()).map((g) => g.value)).toEqual([]);
    await pointTo(page, -120, 0, LEFT);
  });
});

test.describe("under reduced motion Pip holds still", () => {
  test.use({ reducedMotion: "reduce" });

  test("on Welcome his gaze stays forward, and near him on the step it stays at rest, until Settings turns motion back on", async ({
    page,
  }) => {
    await page.goto("/");
    const c = await centre(page);
    const gazes = await noteGazes(page);
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(c.x - 320 + i * 8, c.y + i * 4, { steps: 2 });
      await page.waitForTimeout(150);
    }
    expect((await gazes()).map((g) => g.value)).toEqual([]);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", FORWARD);

    await page.goto(STEP);
    const s = await centre(page);
    await page.mouse.move(s.x - 120, s.y, { steps: 4 });
    await page.mouse.move(s.x - 110, s.y, { steps: 4 });
    await page.waitForTimeout(300);
    await expect(pip(page)).toHaveAttribute("data-pip-gaze", REST);

    // The Settings override for full motion: he follows again.
    await page.evaluate(() => {
      document.documentElement.dataset.motion = "full";
    });
    await pointTo(page, -120, 0, LEFT);
  });
});

test("touch and pen are never followed; the mouse is", async ({ page }) => {
  await page.goto("/");
  const c = await centre(page);
  // Past the Greeting, so the mouse below would be followed at once.
  await pointTo(page, 0, 0, (x, y) => x === 0 && y === 0);
  await page.waitForTimeout(1_800);
  const gazes = await noteGazes(page);
  for (const pointerType of ["touch", "pen"]) {
    for (let i = 0; i < 6; i++) {
      await synthetic(page, c.x - 320 + i * 6, c.y, pointerType);
      await page.waitForTimeout(50);
    }
  }
  expect((await gazes()).map((g) => g.value)).toEqual([]);
  await synthetic(page, c.x - 320, c.y, "mouse");
  await expect.poll(async () => (await gaze(page))[0]).toBeLessThan(-0.3);
});
