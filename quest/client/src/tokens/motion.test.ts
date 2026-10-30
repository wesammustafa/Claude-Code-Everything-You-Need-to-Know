import { describe, expect, test } from "vitest";
import css from "../styles/tokens.css?raw";
import { fullMotion, reducedMotion } from "./tokens";

const full = fullMotion(css);
const reduced = reducedMotion(css);
const ms = (value: string | undefined) => {
  const m = /^([\d.]+)(ms|s)$/.exec(value ?? "");
  if (!m?.[1]) throw new Error(`Not a duration: ${String(value)}`);
  return Number(m[1]) * (m[2] === "s" ? 1000 : 1);
};

describe("motion tokens", () => {
  test("follow the spec's durations", () => {
    expect(
      ["press", "fast", "base", "slow", "moment"].map((d) =>
        ms(full.get(`--duration-${d}`)),
      ),
    ).toEqual([90, 140, 220, 360, 560]);
    expect(ms(full.get("--stagger"))).toBe(40);
    expect(full.get("--rise")).toBe("8px");
    expect(ms(full.get("--duration-turn"))).toBe(220);
  });

  test("reduced motion keeps state changes as fades of at most 120 ms", () => {
    for (const [name, value] of full) {
      if (!name.startsWith("--duration-")) continue;
      const effective = reduced.get(name) ?? value;
      expect(ms(effective), name).toBeLessThanOrEqual(120);
    }
  });

  test("reduced motion removes every travel, hop and spring", () => {
    expect(reduced.get("--rise")).toBe("0px");
    expect(reduced.get("--press-y")).toBe("0px");
    expect(reduced.get("--press-scale")).toBe("1");
    expect(reduced.get("--hover-scale")).toBe("1");
    expect(reduced.get("--nudge")).toBe("0px");
    // A rotation is travel too: a turning mark snaps to its new angle.
    expect(reduced.get("--duration-turn")).toBe("0ms");
    expect(reduced.get("--pop-from")).toBe("1");
    expect(reduced.get("--stagger")).toBe("0ms");
    expect(reduced.get("--ease-spring")).toBe("var(--ease-out)");
    expect(reduced.get("--animate-breathe")).toBe("none");
  });

  test("a Switch's thumb keeps its place under reduced motion, and snaps there", () => {
    // Its travel marks which state the Switch is in, so reduced motion keeps
    // it and drops only the transition (components/Switch.tsx).
    expect(full.get("--switch-travel")).toBe("16px");
    expect(reduced.has("--switch-travel")).toBe(false);
  });

  test("reduced motion follows the system setting unless the Settings switch picks", () => {
    expect(css).toMatch(
      /@custom-variant reduced \{\s*@media \(prefers-reduced-motion: reduce\)/,
    );
    expect(css).toContain('[data-motion="reduce"]');
    expect(css).toContain('[data-motion="full"]');
  });
});
