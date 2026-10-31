// The cold-start budget (spec: Performance budget, item 6): three cold loads
// of the Lesson step, each in a fresh context with the cache disabled and the
// CPU throttled 6x through the DevTools protocol, and the median of each
// measure against its limit. The target is the built client under `vite
// preview` with live.ts's fakes: what is timed is the app's own first screen,
// and item 5 (budgets.mjs) already times the server's start-up. The numbers
// are printed, and appended to $GITHUB_STEP_SUMMARY when it is set, after
// every run, so a failed run still reports what was measured. The spec has its
// own Playwright project, which runs after every other spec, so no other
// page shares the CPU while it times.
import { appendFileSync } from "node:fs";
import { expect, test } from "./live.ts";
import { STEP } from "./pip-page.ts";

interface ColdStart {
  poster?: number;
  usable?: number;
  animated?: number;
  unavailable?: number;
}

declare global {
  interface Window {
    __coldStart?: ColdStart;
  }
}

const LIMITS = Object.freeze([
  { id: "fcp", label: "first contentful paint", limitMs: 1000 },
  { id: "usable", label: "Lesson usable", limitMs: 1500 },
  { id: "animated", label: "Pip animated", limitMs: 3000 },
] as const);

type Run = Record<(typeof LIMITS)[number]["id"], number>;

const runs: Run[] = [];

/** In the page: the first time each signal holds, from timeOrigin. */
function observeColdStart() {
  const times: ColdStart = {};
  window.__coldStart = times;
  const look = () => {
    const now = performance.now();
    // Usable: the step rendered and the action bar's main action enabled.
    if (
      times.usable === undefined &&
      document.querySelector("main article [data-page-title]") &&
      [...document.querySelectorAll("[data-action-bar] button")].some(
        (button) =>
          button.getAttribute("aria-disabled") !== "true" &&
          button.getAttribute("aria-busy") !== "true",
      )
    )
      times.usable = now;
    // Animated: the rig's first frame drawn over the poster.
    if (
      times.animated === undefined &&
      document.querySelector('[data-pip][data-pip-rendering="rig"]')
    )
      times.animated = now;
    // Poster: a poster image decoded, so Pip shows while the rig loads.
    if (
      times.poster === undefined &&
      [
        ...document.querySelectorAll<HTMLImageElement>("img[data-pip-poster]"),
      ].some((img) => img.complete && img.naturalWidth > 0)
    )
      times.poster = now;
    if (
      times.unavailable === undefined &&
      document.querySelector('[data-pip-rendering="unavailable"]')
    )
      times.unavailable = now;
  };
  // An image loading changes no attribute, so its load event looks too.
  document.addEventListener("load", look, true);
  new MutationObserver(look).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
  });
}

// No retries: the medians read the three runs this worker pushed, in order.
test.describe.configure({ mode: "serial", retries: 0 });
test.use({ viewport: { width: 1280, height: 900 } });

for (const n of [1, 2, 3]) {
  test(`cold start ${String(n)}`, async ({ context, page }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.addInitScript(observeColdStart);
    await page.goto(STEP);
    await page.waitForFunction(
      () => {
        const c = window.__coldStart;
        return c && (c.unavailable ?? (c.usable && c.animated));
      },
      null,
      { timeout: 20_000 },
    );
    const { fcp, times } = await page.evaluate(() => ({
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
      times: window.__coldStart ?? {},
    }));
    expect(times.unavailable, "Pip unavailable: no WebGL2").toBeUndefined();
    expect(fcp, "no first-contentful-paint entry").toBeDefined();
    expect(
      times.poster,
      "no Pip poster shown during the cold start",
    ).toBeDefined();
    expect(
      times.poster ?? Infinity,
      "the poster showed only after the rig",
    ).toBeLessThanOrEqual(times.animated ?? Infinity);
    runs.push({
      fcp: fcp ?? Infinity,
      usable: times.usable ?? Infinity,
      animated: times.animated ?? Infinity,
    });
  });
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Infinity;

const ms = (value: number) => `${String(Math.round(value))} ms`;

function budgetRows() {
  return LIMITS.map(({ id, label, limitMs }) => {
    const values = runs.map((run) => run[id]);
    const mid = median(values);
    return { label, values, mid, limitMs, ok: mid <= limitMs };
  });
}

// After every run, the failed ones too: the numbers measured so far.
test.afterAll(() => {
  const cells = budgetRows().map((row) => [
    row.label,
    ...[0, 1, 2].map((i) => {
      const value = row.values[i];
      return value === undefined ? "-" : ms(value);
    }),
    ms(row.mid),
    ms(row.limitMs),
    row.ok ? "ok" : "FAIL",
  ]);
  const head = ["Measure", "Run 1", "Run 2", "Run 3", "Median", "Limit", ""];
  const widths = head.map((h, i) =>
    Math.max(h.length, ...cells.map((c) => c[i]?.length ?? 0)),
  );
  const line = (c: string[]) =>
    c
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd();
  console.log(["Cold start", line(head), ...cells.map(line)].join("\n"));
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const md = (c: string[]) => `| ${c.join(" | ")} |`;
    try {
      appendFileSync(
        summary,
        `### Cold start\n\n${[md(head), md(head.map(() => "---")), ...cells.map(md)].join("\n")}\n\n`,
      );
    } catch (error) {
      console.error(
        `Could not write the CI summary: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
});

test("medians are within budget", () => {
  expect(runs, "every cold start ran").toHaveLength(3);
  for (const row of budgetRows())
    expect
      .soft(
        row.mid,
        `median ${row.label} ${ms(row.mid)} is over ${ms(row.limitMs)}`,
      )
      .toBeLessThanOrEqual(row.limitMs);
});
