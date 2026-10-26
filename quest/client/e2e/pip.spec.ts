// Pip in the app: the poster paints at once, the Rive runtime loads after the
// first paint from the app's own origin and takes over, the rig pauses when
// Pip can't be seen, every way Rive can fail keeps the poster with the Lesson
// usable, and a Reaction plays once per event ID, also across two tabs.
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import { changedShare, drawnBounds, type Rgba } from "../pip/png.ts";
import { RIG, RUNTIME, STEP, WASM, lessonUsable, pip } from "./pip-page.ts";
import { watch } from "./watch.ts";

async function rigDrawn(page: Page) {
  await expect(pip(page)).toHaveAttribute("data-pip-rendering", "rig", {
    timeout: 20_000,
  });
}

/** Holds every request to `url` until the returned function is called. */
async function hold(page: Page, url: RegExp): Promise<() => void> {
  const { promise: released, resolve } = Promise.withResolvers<undefined>();
  await page.route(url, async (route: Route) => {
    await released;
    await route.continue();
  });
  return () => {
    resolve(undefined);
  };
}

interface TestEvent {
  id: string;
  type: string;
  [field: string]: unknown;
}

/** One revision's events, through the page's local event source. */
async function send(page: Page, ...events: TestEvent[]) {
  await page.evaluate((batch) => {
    window.dispatchEvent(
      new CustomEvent("quest:events", {
        detail: batch.map((event) => ({
          revision: 1,
          serverTime: Date.now(),
          ...event,
        })),
      }),
    );
  }, events);
}

/** The canvas's current frame, over white. */
async function frame(page: Page): Promise<Rgba> {
  const { width, height, base64 } = await pip(page)
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
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

/** How much of the rig's picture changes over `ms` of real time. */
async function motion(page: Page, ms: number): Promise<number> {
  const before = await frame(page);
  await page.waitForTimeout(ms);
  return changedShare(before, await frame(page));
}

/** Pretends the page was hidden or shown, as switching tabs does. */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => value,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (value ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test("Pip's poster paints at once, and the rig takes over after the first paint", async ({
  page,
}) => {
  const seen = watch(page);
  const release = await hold(page, RUNTIME);
  await page.goto(STEP);

  // The poster for the current mode is there with the screen, before any of the runtime.
  const poster = pip(page).locator("img[data-pip-poster=idle]");
  await expect(poster).toBeVisible();
  expect(await poster.evaluate((img: HTMLImageElement) => img.complete)).toBe(
    true,
  );
  await expect(pip(page)).toHaveAttribute("data-pip-rendering", "poster");
  await expect(pip(page).locator("canvas")).toHaveCount(0);
  // Its layout size: the screen may still be rising in, and a moving box
  // measures in fractions of a pixel.
  expect(
    await pip(page).evaluate((el: HTMLElement) => [
      el.offsetWidth,
      el.offsetHeight,
    ]),
  ).toEqual([76, 76]);

  // The runtime was asked for only after the first paint.
  await expect
    .poll(() => seen.requests.some((url) => RUNTIME.test(url.pathname)))
    .toBe(true);
  release();
  await rigDrawn(page);
  const timing = await page.evaluate(() => ({
    paint: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
    runtime: performance
      .getEntriesByType("resource")
      .find((entry) => /\/PipRive-/.test(entry.name))?.startTime,
  }));
  expect(timing.paint).toBeDefined();
  expect(timing.runtime).toBeGreaterThan(timing.paint ?? Infinity);

  // The rig is drawn, hidden from screen readers, and the poster has faded out.
  const canvas = pip(page).locator("canvas");
  await expect(canvas).toHaveAttribute("aria-hidden", "true");
  expect(await canvas.getAttribute("tabindex")).toBeNull();
  await expect(pip(page)).toHaveAttribute("aria-hidden", "true");
  await expect
    .poll(() => poster.evaluate((img) => getComputedStyle(img).opacity))
    .toBe("0");
  expect(drawnBounds(await frame(page))).not.toBeNull();
  await expect(pip(page)).toHaveAttribute("data-pip-playing", "true");

  // Everything came from the app's own origin: the WASM as application/wasm.
  expect(
    seen.requests.filter((url) => url.hostname !== "127.0.0.1").map(String),
  ).toEqual([]);
  const wasm = seen.requests.find((url) => WASM.test(url.pathname));
  expect(wasm?.origin).toBe("http://127.0.0.1:4319");
  const response = await page.request.get(String(wasm));
  expect(response.headers()["content-type"]).toBe("application/wasm");
  expect(seen.requests.some((url) => RIG.test(url.pathname))).toBe(true);
  expect(seen.problems).toEqual([]);
});

test("every screen with Pip draws the rig, and Welcome greets at the hero size", async ({
  page,
}) => {
  const seen = watch(page);
  // The runtime is held until the Greeting has come, its poster has let go,
  // and well over 3 s have passed since it came: the Greeting waits for the
  // rig however long the rig takes, as on a slow machine.
  const release = await hold(page, RUNTIME);
  await page.goto("/");
  await expect(pip(page)).toHaveAttribute("data-pip", "hero");
  await expect(pip(page)).toHaveAttribute("data-pip-reaction", "greeting");
  await expect(pip(page)).not.toHaveAttribute("data-pip-reaction", {
    timeout: 5_000,
  });
  await page.waitForTimeout(2_000);
  await expect(pip(page)).toHaveAttribute("data-pip-rendering", "poster");
  expect(seen.requests.some((url) => RUNTIME.test(url.pathname))).toBe(true);
  release();
  await rigDrawn(page);
  await expect(pip(page)).toHaveAttribute("data-pip-reaction", "greeting");
  expect(
    await pip(page).evaluate((el: HTMLElement) => [
      el.offsetWidth,
      el.offsetHeight,
    ]),
  ).toEqual([208, 208]);
  for (const path of [
    "/#/lesson/b-1",
    STEP,
    "/#/lesson/b-1/complete",
    "/#/nowhere",
  ]) {
    await page.goto(path);
    await rigDrawn(page);
  }
  expect(seen.problems).toEqual([]);
});

test("the Lesson's controls are usable before the Rive runtime finishes loading", async ({
  page,
}) => {
  const seen = watch(page);
  const release = await hold(page, WASM);
  await page.goto(STEP);
  await expect(pip(page)).toHaveAttribute("data-pip-rendering", "poster");
  await lessonUsable(page);
  // Still waiting for the runtime: nothing on the page waited for it.
  await expect(pip(page)).toHaveAttribute("data-pip-rendering", "poster");
  release();
  await rigDrawn(page);
  expect(seen.problems).toEqual([]);
});

test.describe("Rive unavailable", () => {
  // Chromium reports a request the test refuses with a console line of its
  // own; that one line is the browser's, never the page's.
  const REFUSED = "error: Failed to load resource: net::ERR_FAILED";

  for (const [name, url, reply] of [
    ["the WASM route refused", WASM, "abort"],
    ["the runtime's code refused", RUNTIME, "abort"],
    ["the rig refused", RIG, "abort"],
    ["the rig broken", RIG, "garbage"],
    ["the WASM broken", WASM, "garbage"],
  ] as const) {
    test(`${name}: the poster stays, no error reaches the page, and the Lesson is usable`, async ({
      page,
    }) => {
      const seen = watch(page);
      await page.route(url, (route) =>
        reply === "abort"
          ? route.abort()
          : route.fulfill({
              status: 200,
              contentType: url === WASM ? "application/wasm" : "",
              body: Buffer.from("not what it should be"),
            }),
      );
      await page.goto(STEP);
      await expect(pip(page)).toHaveAttribute(
        "data-pip-rendering",
        "unavailable",
        { timeout: 20_000 },
      );
      await expect(pip(page).locator("img[data-pip-poster=idle]")).toHaveCSS(
        "opacity",
        "1",
      );
      await expect(pip(page).locator("canvas")).toHaveCount(0);
      await lessonUsable(page);
      expect(seen.problems).toEqual(reply === "abort" ? [REFUSED] : []);
    });
  }
  test("WebGL2 there for the probe and refused to the runtime: the poster stays, no error reaches the page, and the Lesson is usable", async ({
    page,
  }) => {
    const seen = watch(page);
    // The probe's context is the page's first WebGL2 context; every later
    // one is refused, as a browser out of contexts or GPU memory would.
    await page.addInitScript(() => {
      let made = 0;
      const proto = HTMLCanvasElement.prototype;
      const getContext = Object.getOwnPropertyDescriptor(proto, "getContext");
      const original: unknown = getContext?.value;
      if (typeof original !== "function") return;
      Object.defineProperty(proto, "getContext", {
        ...getContext,
        value: function (this: HTMLCanvasElement, ...args: unknown[]) {
          if (args[0] === "webgl2" && made++ > 0) return null;
          const context: unknown = original.apply(this, args);
          return context;
        },
      });
    });
    await page.goto(STEP);
    await expect(pip(page)).toHaveAttribute(
      "data-pip-rendering",
      "unavailable",
      { timeout: 20_000 },
    );
    await expect(pip(page).locator("img[data-pip-poster=idle]")).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(pip(page).locator("canvas")).toHaveCount(0);
    await lessonUsable(page);
    expect(seen.requests.some((url) => WASM.test(url.pathname))).toBe(true);
    expect(seen.problems).toEqual([]);
  });
});

test("the rig pauses while Pip is scrolled off-screen or the page is hidden", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 420 });
  await page.goto(STEP);
  await rigDrawn(page);
  expect(await motion(page, 600)).toBeGreaterThan(0);

  // Scrolled out of view: paused, and the picture holds still.
  await page.mouse.wheel(0, 1000);
  await expect(pip(page)).toHaveAttribute("data-pip-playing", "false");
  expect(await motion(page, 600)).toBe(0);
  await page.mouse.wheel(0, -1000);
  await expect(pip(page)).toHaveAttribute("data-pip-playing", "true");
  await expect.poll(() => motion(page, 600)).toBeGreaterThan(0);

  // The page hidden, as in another tab: paused again until it shows.
  await setHidden(page, true);
  await expect(pip(page)).toHaveAttribute("data-pip-playing", "false");
  expect(await motion(page, 600)).toBe(0);
  await setHidden(page, false);
  await expect(pip(page)).toHaveAttribute("data-pip-playing", "true");
  await expect.poll(() => motion(page, 600)).toBeGreaterThan(0);
});

test("when the rig's WebGL context is lost Pip shows its poster, and the rig comes back when the context does", async ({
  page,
}) => {
  const seen = watch(page);
  // Notes each WebGL2 context the page makes, to lose and restore it as a
  // GPU reset would.
  await page.addInitScript(() => {
    const contexts: WebGL2RenderingContext[] = [];
    Object.assign(window, { webgl2Contexts: contexts });
    const proto = HTMLCanvasElement.prototype;
    const getContext = Object.getOwnPropertyDescriptor(proto, "getContext");
    const original: unknown = getContext?.value;
    if (typeof original !== "function") return;
    Object.defineProperty(proto, "getContext", {
      ...getContext,
      value: function (this: HTMLCanvasElement, ...args: unknown[]) {
        const context: unknown = original.apply(this, args);
        if (context instanceof WebGL2RenderingContext) contexts.push(context);
        return context;
      },
    });
  });
  await page.goto(STEP);
  await rigDrawn(page);

  const lost = await page.evaluate(() => {
    const { webgl2Contexts } = window as unknown as {
      webgl2Contexts: WebGL2RenderingContext[];
    };
    const losing = webgl2Contexts.flatMap((gl) => {
      const extension = gl.isContextLost()
        ? null
        : gl.getExtension("WEBGL_lose_context");
      return extension === null ? [] : [extension];
    });
    for (const extension of losing) extension.loseContext();
    Object.assign(window, { lostContexts: losing });
    return losing.length;
  });
  expect(lost).toBeGreaterThan(0);
  await expect(pip(page)).toHaveAttribute("data-pip-rendering", "unavailable");
  await expect(pip(page).locator("canvas")).toHaveCount(0);
  await expect(pip(page).locator("img[data-pip-poster=idle]")).toHaveCSS(
    "opacity",
    "1",
  );
  await lessonUsable(page);

  await page.evaluate(() => {
    const { lostContexts } = window as unknown as {
      lostContexts: WEBGL_lose_context[];
    };
    for (const extension of lostContexts) extension.restoreContext();
  });
  await rigDrawn(page);
  await expect(pip(page)).toHaveAttribute("data-pip-playing", "true");
  expect(drawnBounds(await frame(page))).not.toBeNull();
  await expect.poll(() => motion(page, 600)).toBeGreaterThan(0);
  expect(seen.problems).toEqual([]);
});

test.describe("a Reaction plays once per event ID", () => {
  async function openStep(context: BrowserContext) {
    const page = await context.newPage();
    await page.goto(STEP);
    await rigDrawn(page);
    return page;
  }

  /**
   * Notes every Reaction Pip starts on the page from now on, so a test can
   * tell one never played, not only that it isn't playing now.
   */
  async function noteReactions(page: Page): Promise<() => Promise<string[]>> {
    await page.evaluate(() => {
      const started: string[] = [];
      Object.assign(window, { startedReactions: started });
      new MutationObserver((records) => {
        for (const record of records) {
          const id = (record.target as Element).getAttribute(
            "data-pip-reaction",
          );
          if (id !== null && started.at(-1) !== id) started.push(id);
        }
      }).observe(document.body, {
        subtree: true,
        attributeFilter: ["data-pip-reaction"],
      });
    });
    return () =>
      page.evaluate(
        () =>
          (window as unknown as { startedReactions: string[] })
            .startedReactions,
      );
  }

  /** The channel the test signals tabs on, to act at the same moment. */
  const SIGNAL = "e2e:signal";

  /**
   * Has the page send one batch when the test signals, so several tabs hear
   * it at the same moment, each before any tab's message about it can reach
   * the others. Returns a function that waits until the page has sent it.
   */
  async function sendOnSignal(
    page: Page,
    ...events: TestEvent[]
  ): Promise<() => Promise<void>> {
    const handle = await page.evaluateHandle(
      ({ name, batch }) => {
        const channel = new BroadcastChannel(name);
        // Wrapped, so the handle is taken now rather than once it resolves.
        return {
          sent: new Promise<void>((resolve) => {
            channel.onmessage = () => {
              channel.close();
              window.dispatchEvent(
                new CustomEvent("quest:events", {
                  detail: batch.map((event) => ({
                    revision: 1,
                    serverTime: Date.now(),
                    ...event,
                  })),
                }),
              );
              resolve();
            };
          }),
        };
      },
      { name: SIGNAL, batch: events },
    );
    return () => handle.evaluate((armed) => armed.sent);
  }

  /** Signals every page waiting in sendOnSignal, the sender's own included. */
  async function signal(page: Page) {
    await page.evaluate((name) => {
      const channel = new BroadcastChannel(name);
      channel.postMessage("now");
      channel.close();
    }, SIGNAL);
  }

  test("in one tab, an ID that comes again plays nothing", async ({
    context,
  }) => {
    const page = await openStep(context);
    const seen = watch(page);
    await expect(pip(page)).not.toHaveAttribute("data-pip-reaction");
    const started = await noteReactions(page);

    await send(page, { id: "a.1", type: "check.passed", firstTime: true });
    await expect(pip(page)).toHaveAttribute("data-pip-reaction", "a.1");
    await send(page, { id: "a.2", type: "answer.wrong" });
    await expect(pip(page)).toHaveAttribute("data-pip-reaction", "a.2");
    // a.1 again: dropped. a.3 after it plays, so a.1 was settled by then.
    await send(page, { id: "a.1", type: "check.passed", firstTime: true });
    await send(page, { id: "a.3", type: "hint.shown", rung: 1 });
    await expect(pip(page)).toHaveAttribute("data-pip-reaction", "a.3");
    expect(await started()).toEqual(["a.1", "a.2", "a.3"]);
    expect(seen.problems).toEqual([]);
  });

  test("across two tabs, an ID both tabs hear at the same moment plays in exactly one", async ({
    context,
  }) => {
    const first = await openStep(context);
    const second = await openStep(context);
    const startedFirst = await noteReactions(first);
    const startedSecond = await noteReactions(second);

    const passed = { id: "b.1", type: "check.passed", firstTime: true };
    const sent = await Promise.all([
      sendOnSignal(first, passed),
      sendOnSignal(second, passed),
    ]);
    await signal(first);
    await Promise.all(sent.map((done) => done()));
    // Then an ID of each tab's own, which plays there: b.1 was settled in
    // each tab before it.
    await send(first, { id: "b.2", type: "hint.shown", rung: 1 });
    await send(second, { id: "b.3", type: "hint.shown", rung: 1 });
    await expect(pip(first)).toHaveAttribute("data-pip-reaction", "b.2");
    await expect(pip(second)).toHaveAttribute("data-pip-reaction", "b.3");
    const played = [...(await startedFirst()), ...(await startedSecond())];
    expect(played.filter((id) => id === "b.1")).toEqual(["b.1"]);

    // Heard again later by either tab, b.1 still plays nowhere.
    await send(first, passed);
    await send(second, passed);
    await send(first, { id: "b.4", type: "answer.wrong" });
    await send(second, { id: "b.5", type: "answer.wrong" });
    await expect(pip(first)).toHaveAttribute("data-pip-reaction", "b.4");
    await expect(pip(second)).toHaveAttribute("data-pip-reaction", "b.5");
    const again = [...(await startedFirst()), ...(await startedSecond())];
    expect(again.filter((id) => id === "b.1")).toEqual(["b.1"]);
  });
});
