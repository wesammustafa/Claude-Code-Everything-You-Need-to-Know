// Reduced motion, component by component, under each way it can be set: no
// preference; the system asking for it; the Settings switch asking for it;
// and the switch's full motion overriding the system. Under reduced motion
// nothing travels, hops or springs, and every state change is a fade of at
// most 120 ms.
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, test, vi } from "vitest";
import {
  injectTokens,
  renderWithMotion,
  setMotionSwitch,
  stubReducedMotion,
} from "../../test/motion";
import { literalMoves } from "../../test/token-classes";
import {
  fillEntrance,
  motionTokens,
  popEntrance,
  revealEntrance,
  saysEntrance,
  type CurrentMotion,
  type Entrance,
} from "../lib/motion";
import { motionReduced } from "../lib/page";
import { ActionBar } from "../shell/ActionBar";
import css from "../styles/tokens.css?raw";
import { block, fullMotion, reducedMotion } from "../tokens/tokens";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { CheckLines } from "./CheckLines";
import { Choice } from "./Choice";
import { Command } from "./Command";
import { Disclosure } from "./Disclosure";
import { FixedLayer } from "./FixedLayer";
import { HelpOffer } from "./HelpOffer";
import { Hints } from "./Hints";
import { IconButton } from "./IconButton";
import { Notice } from "./Notice";
import { Panel } from "./Panel";
import { ProgressBar } from "./ProgressBar";
import { Says } from "./Says";
import { Segmented } from "./Segmented";
import { StepDots } from "./StepDots";
import { Switch } from "./Switch";
import { Tier } from "./Tier";
import { Where } from "./Where";

const REDUCED_MAX_MS = 120;
const none = () => undefined;
const full = fullMotion(css);
const reduced = reducedMotion(css);

const CONDITIONS = [
  { name: "no preference", system: false, choice: null, reduce: false },
  { name: "the system reducing", system: true, choice: null, reduce: true },
  {
    name: "the switch reducing",
    system: false,
    choice: "reduce",
    reduce: true,
  },
  {
    name: "the switch's full motion over the system's reduce",
    system: true,
    choice: "full",
    reduce: false,
  },
] as const;

type Condition = (typeof CONDITIONS)[number];

async function apply(condition: Condition) {
  stubReducedMotion(condition.system);
  await setMotionSwitch(condition.choice);
  expect(motionReduced()).toBe(condition.reduce);
}

const ms = (value: string | undefined) => {
  const m = /^([\d.]+)(ms|s)$/.exec(value ?? "");
  return m?.[1] === undefined ? NaN : Number(m[1]) * (m[2] === "s" ? 1000 : 1);
};

// Tokens that move something: reduced motion sets each to none.
const TRAVEL = /--(rise|press-y|press-scale|hover-scale|nudge|pop-from)\b/g;

/** The custom properties a keyframes rule reads. */
function keyframeTokens(name: string): string[] {
  return [...block(css, `@keyframes ${name} {`).matchAll(/var\((--[\w-]+)\)/g)]
    .map((m) => m[1] ?? "")
    .filter(Boolean);
}

// Components whose motion is CSS: transitions and keyframes from tokens.
const CSS_DRIVEN: readonly [string, () => ReactElement][] = [
  ["Button", () => <Button iconEnd="arrow">Next step</Button>],
  ["IconButton", () => <IconButton icon="close" label="Close" />],
  ["Command", () => <Command text="npm run learn" />],
  ["StepDots", () => <StepDots steps={["One", "Two"]} at={1} />],
  [
    "CheckLines",
    () => (
      <CheckLines
        lines={[
          { text: "met", ok: true },
          { text: "not yet", ok: false, evidence: "seen" },
          { text: "checking", ok: false, state: "waiting" },
        ]}
      />
    ),
  ],
  ["HelpOffer", () => <HelpOffer open onShowHint={none} onDismiss={none} />],
  ["Notice", () => <Notice kind="reconnecting" />],
  [
    "Panel",
    () => (
      <Panel title="Settings" open onClose={none}>
        Body
      </Panel>
    ),
  ],
  [
    "Disclosure",
    () => (
      <Disclosure summary="More" count={{ value: 2, label: "2 things" }}>
        Body
      </Disclosure>
    ),
  ],
  [
    "Segmented",
    () => (
      <Segmented
        legend="Theme"
        value="a"
        onChange={none}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />
    ),
  ],
  ["Switch", () => <Switch label="Sound" checked onChange={none} />],
  ["Tier", () => <Tier tier="hinted" />],
  ["Where", () => <Where kind="claude" label="Claude Code" note="beside" />],
];

// Components that animate through Motion: the element that moves, the
// entrance it takes, and what full motion moves.
const MOTION_DRIVEN: readonly [
  name: string,
  ui: () => ReactElement,
  selector: string,
  entrance: (t: CurrentMotion) => Entrance,
  travels: (style: CSSStyleDeclaration) => boolean,
][] = [
  [
    "Says",
    () => (
      <Says textKey="a" pip={<span />}>
        Watching
      </Says>
    ),
    "[data-says-words]",
    saysEntrance,
    (s) => /translateY/.test(s.transform),
  ],
  [
    "ProgressBar",
    () => <ProgressBar value={1} max={3} label="Progress" />,
    "[data-fill]",
    (t) => fillEntrance(t, 1 / 3),
    (s) => /translateX/.test(s.transform),
  ],
  [
    "Badge",
    () => <Badge shape="hexagon" earned name="Organizer" reveal />,
    "[data-badge-shape]",
    popEntrance,
    (s) => /scale\(/.test(s.transform),
  ],
  [
    "Hints",
    () => <Hints hints={["Look in src."]} shown={1} onShowNext={none} />,
    "[data-hint-rung]",
    revealEntrance,
    (s) => s.height === "0px",
  ],
  [
    "Choice",
    () => (
      <Choice
        legend="Q"
        value="a"
        onChange={none}
        result={{ id: "a", state: "right" }}
        options={[{ id: "a", text: "A", because: "Why" }]}
      />
    ),
    "[data-because]",
    revealEntrance,
    (s) => s.height === "0px",
  ],
];

describe.each(CONDITIONS)("under $name", (condition) => {
  test.each(CSS_DRIVEN)(
    "%s moves only by tokens that reduced motion stills",
    async (_name, ui) => {
      injectTokens();
      await apply(condition);
      render(<MemoryRouter>{ui()}</MemoryRouter>);
      // Each token as the page holds it under this condition: the
      // stylesheet's own value, or reduced motion's in its place.
      const root = getComputedStyle(document.documentElement);
      const live = (token: string) => root.getPropertyValue(token).trim();
      const expected = (token: string) =>
        (condition.reduce ? reduced.get(token) : undefined) ?? full.get(token);
      const classes = [...document.body.querySelectorAll("[class]")]
        .map((el) => el.getAttribute("class") ?? "")
        .join(" ");
      expect(literalMoves(classes)).toEqual([]);

      for (const [, token] of classes.matchAll(TRAVEL)) {
        const name = `--${token ?? ""}`;
        expect(reduced.has(name), name).toBe(true);
        expect(live(name), name).toBe(expected(name));
      }
      // A Switch's thumb travels to show its state, so it keeps its place
      // and only snaps there under reduced motion.
      if (classes.includes("--switch-travel"))
        expect(classes).toContain("reduced:transition-[background-color]");

      for (const [, name] of classes.matchAll(/\banimate-([\w-]+)/g)) {
        if (name === "breathe") {
          expect(reduced.get("--animate-breathe")).toBe("none");
          continue;
        }
        for (const token of keyframeTokens(name ?? "")) {
          expect(reduced.has(token), `${name ?? ""}: ${token}`).toBe(true);
          expect(live(token), `${name ?? ""}: ${token}`).toBe(expected(token));
        }
      }
      for (const [, token = ""] of classes.matchAll(
        /duration-\((--[\w-]+)\)/g,
      )) {
        expect(live(token), token).toBe(expected(token));
        if (condition.reduce)
          expect(ms(live(token)), token).toBeLessThanOrEqual(REDUCED_MAX_MS);
      }
    },
  );

  test.each(MOTION_DRIVEN)(
    "%s fades only, at most 120 ms, when motion is reduced",
    async (_name, ui, selector, entrance, travels) => {
      await apply(condition);
      renderWithMotion(ui());
      const node = document.querySelector<HTMLElement>(selector);
      expect(node).not.toBeNull();
      const style = (node as HTMLElement).style;
      const used = entrance({ ...motionTokens(), reduced: condition.reduce });
      if (condition.reduce) {
        expect(style.transform).not.toMatch(/translate|scale/);
        expect(style.height).toBe("");
        expect(style.opacity).toBe("0");
        expect(Object.keys(used.initial)).toEqual(["opacity"]);
        expect(used.transition.type).toBeUndefined();
        expect(used.transition.duration).toBeLessThanOrEqual(
          REDUCED_MAX_MS / 1000,
        );
      } else {
        expect(travels(style)).toBe(true);
      }
    },
  );
});

describe("fixed layers", () => {
  test("the action bar, a Panel and any FixedLayer render into <body>, never inside the animated screen", () => {
    const { container } = render(
      <MemoryRouter>
        <div data-screen="" className="animate-rise">
          <ActionBar>
            <Button>Next step</Button>
          </ActionBar>
          <Panel title="Steps" open onClose={vi.fn()}>
            Body
          </Panel>
          <FixedLayer>
            <div data-testid="layer" />
          </FixedLayer>
        </div>
      </MemoryRouter>,
    );
    const screenFrame = container.querySelector("[data-screen]");
    for (const layer of [
      document.querySelector("[data-action-bar]"),
      document.querySelector("[data-panel-scrim]"),
      document.querySelector("[data-testid=layer]"),
    ]) {
      expect(layer).not.toBeNull();
      expect(layer?.parentElement).toBe(document.body);
      expect(screenFrame?.contains(layer ?? null)).toBe(false);
    }
  });
});
