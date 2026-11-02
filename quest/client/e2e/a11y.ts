// Shared steps for the accessibility specs (255): a theme, a settled page,
// axe's serious and critical findings, a Tab walk, the focus ring, and a log
// of what each live region says.
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The system theme, with reduced motion so a scan sees the settled page. */
export async function useTheme(page: Page, scheme: Theme, motion = false) {
  await page.emulateMedia({
    colorScheme: scheme,
    reducedMotion: motion ? "no-preference" : "reduce",
  });
}

/** Waits for fonts, Pip's words and every running animation to finish. */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const frame = () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(null);
        });
      });
    for (let i = 0; i < 40; i += 1) {
      const words = document.querySelector("[data-says-words]");
      if (!words || getComputedStyle(words).opacity === "1") break;
      await frame();
    }
    await frame();
    await frame();
    // An endless or paused animation (a spinner, Pip's idle) never
    // finishes, so the wait gives up after a few seconds.
    await Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === "running" &&
              a.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((a) => a.finished.catch(() => null)),
      ),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  });
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Fails on any serious or critical finding; attaches the rest. */
export async function expectNoSeriousViolations(
  page: Page,
  testInfo: TestInfo,
  label = "page",
) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  const serious = violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const lower = violations.filter((v) => !serious.includes(v));
  if (lower.length > 0)
    await testInfo.attach(`${label} lower findings`, {
      body: JSON.stringify(
        lower.map((v) => ({
          id: v.id,
          impact: v.impact,
          targets: v.nodes.map((n) => n.target),
        })),
        null,
        2,
      ),
      contentType: "application/json",
    });
  expect(
    serious.map(
      (v) =>
        `${v.id} (${v.impact ?? ""}): ${v.nodes
          .map((n) => `${n.target.join(" ")} ${n.failureSummary ?? ""}`)
          .join(" | ")} ${v.helpUrl}`,
    ),
    label,
  ).toEqual([]);
}

/** What one Tab stop is, enough to tell two apart. */
export interface Stop {
  key: string;
  tag: string;
  role: string;
  name: string;
}

/** The focused element, or null for the body. */
export function activeStop(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (!el || el === document.body || el === document.documentElement)
      return null;
    const w = window as unknown as { __stopIds?: WeakMap<Element, number> };
    w.__stopIds ??= new WeakMap();
    const w2 = window as unknown as { __stopNext?: number };
    let id = w.__stopIds.get(el);
    if (id === undefined) {
      id = (w2.__stopNext ?? 0) + 1;
      w2.__stopNext = id;
      w.__stopIds.set(el, id);
    }
    const name = (
      el.getAttribute("aria-label") ?? (el as HTMLElement).innerText
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return {
      key: `${el.tagName}:${String(id)}:${name}`,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") ?? "",
      name,
    };
  });
}

/**
 * Every element a learner should reach by Tab: visible, enabled, outside
 * inert and aria-hidden, and in `scope` (a dialog) when given.
 */
export function reachable(page: Page, scope?: string): Promise<number> {
  return page.evaluate((within) => {
    const root = within ? document.querySelector(within) : document;
    if (!root) return 0;
    const selector =
      "a[href], button, input, select, textarea, summary, [tabindex]";
    return [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => {
      if (el.tabIndex < 0) return false;
      if (el.matches(":disabled")) return false;
      if (el.closest("[inert], [aria-hidden=true]")) return false;
      // A radio group is one Tab stop: only its checked (or first) radio.
      if (el instanceof HTMLInputElement && el.type === "radio") {
        const group = [
          ...document.querySelectorAll<HTMLInputElement>(
            `input[type=radio][name="${el.name}"]`,
          ),
        ];
        const stop = group.find((r) => r.checked) ?? group[0];
        if (stop !== el) return false;
      }
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return false;
      return getComputedStyle(el).visibility !== "hidden";
    }).length;
  }, scope);
}

/**
 * Presses `key` until focus comes back to where it began (the page closes
 * the loop): every stop is new, no stop holds focus twice in a row, and the
 * body shows only at the wrap. Returns the stops in order.
 */
export async function focusTrail(
  page: Page,
  max: number,
  key: "Tab" | "Shift+Tab" = "Tab",
): Promise<Stop[]> {
  const stops: Stop[] = [];
  const seen = new Set<string>();
  let bodies = 0;
  for (let i = 0; i < max + 5; i += 1) {
    await page.keyboard.press(key);
    const stop = await activeStop(page);
    if (stop === null) {
      bodies += 1;
      expect(bodies, "the body shows only once, at the wrap").toBeLessThan(3);
      continue;
    }
    if (seen.has(stop.key)) {
      expect(stop.key, "the walk wraps to its first stop").toBe(stops[0]?.key);
      return stops;
    }
    expect(stop.key).not.toBe(stops.at(-1)?.key);
    seen.add(stop.key);
    stops.push(stop);
    await expectVisibleFocus(page);
  }
  throw new Error(
    `${key} did not wrap within ${String(max + 5)} presses: ${stops.map((s) => s.name).join(", ")}`,
  );
}

/** The focused element draws the theme's focus ring, 2px or wider. */
export async function expectVisibleFocus(page: Page) {
  const ring = await page.evaluate(async () => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    // A control whose colours transition (transition-colors) takes the ring
    // colour over its duration.
    await Promise.all(
      el.getAnimations().map((a) => a.finished.catch(() => null)),
    );
    const style = getComputedStyle(el);
    // Resolve each token to the rgb() the outline computes to.
    const probe = document.createElement("span");
    document.body.append(probe);
    const colour = (token: string) => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    const tokens = [colour("--color-focus"), colour("--color-focus-on-code")];
    probe.remove();
    return {
      name: el.getAttribute("aria-label") ?? el.innerText.slice(0, 40),
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      colour: style.outlineColor,
      tokens,
    };
  });
  if (ring === null) return;
  expect(ring.style, `focus ring style on ${ring.name}`).not.toBe("none");
  expect(ring.width, `focus ring width on ${ring.name}`).toBeGreaterThanOrEqual(
    2,
  );
  expect(ring.tokens, `focus ring colour on ${ring.name}`).toContain(
    ring.colour,
  );
}

export interface Said {
  region: number;
  text: string;
}

declare global {
  interface Window {
    __said: Said[];
  }
}

/**
 * Logs every change to a live region's words, by region: each region node
 * gets a number the first time it is seen, so a remounted region shows as
 * a new number.
 */
export async function recordLiveRegions(context: BrowserContext) {
  await context.addInitScript(() => {
    window.__said = [];
    const ids = new WeakMap<Element, number>();
    const last = new WeakMap<Element, string>();
    let next = 0;
    const regions = () =>
      document.querySelectorAll("[role=status], [role=alert], [aria-live]");
    const check = () => {
      // A region inside another is logged on its own too: a screen reader
      // can say a change once for each.
      for (const region of regions()) {
        const text = region.textContent.replace(/\s+/g, " ").trim();
        if (!ids.has(region)) {
          next += 1;
          ids.set(region, next);
          last.set(region, text);
          if (text !== "") window.__said.push({ region: next, text });
          continue;
        }
        if (last.get(region) === text) continue;
        last.set(region, text);
        window.__said.push({ region: ids.get(region) ?? 0, text });
      }
    };
    new MutationObserver(check).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

export const said = (page: Page) => page.evaluate(() => [...window.__said]);
