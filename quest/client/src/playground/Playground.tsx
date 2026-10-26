// The Pip Playground: a development-only page for reviewing and approving
// Pip. It drives PipModel directly, or plays engine events and scenarios
// through the app's director, and shows the live rig beside its fallback
// poster and the approved board's art, at every size, in both themes, with
// reduced motion on or off and with Rive available or not.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import {
  PIP_MODES,
  PIP_REACTIONS,
  type PipMode,
  type PipModel,
  type PipReactionKind,
  type PipSize,
} from "../../pip/contract";
import { PIP_SIZES } from "../../pip/posters";
import { cx } from "../lib/cx";
import { motionReduced } from "../lib/page";
import type { PipScreen } from "../pip/director";
import { PipIcon } from "../pip/PipIcon";
import { PipRenderer } from "../pip/PipRenderer";
import { reactionFor } from "../pip/reactions";
import type { StageClock } from "../pip/stage";
import { PageTitle } from "../shell/PageTitle";
import {
  BOARD_FOR,
  BOARD_SECTIONS,
  BOARD_SIZE,
  BOARD_URL,
  ICONS,
  boardState,
  subscribeBoard,
  type BoardCrop,
} from "./board";
import { Action, Section, Segmented, Slider, Switch } from "./controls";
import {
  createPlaygroundDriver,
  durationText,
  pipModelFor,
  type LogEntry,
  type Outcome,
  type PlaygroundDriver,
} from "./driver";
import { EVENT_GROUPS, SCENARIOS } from "./scenarios";

/** Marks the page, so the release build's test can tell it is not there. */
export const PLAYGROUND_MARK = "data-pip-playground";

type Source = "model" | "director";
type Theme = "system" | "dark" | "light";

const SCREENS = [
  "welcome",
  "resume",
  "map",
  "intro",
  "step",
  "levelup",
  "complete",
  "next",
  "levelComplete",
  "courseComplete",
  "other",
] as const satisfies readonly PipScreen[];

/** The intensities the Reaction map uses, marked on the range. */
const INTENSITY_MARKS = [0.2, 0.3, 0.4, 0.5, 0.7, 0.85, 0.9, 1] as const;

/** The head's three looks, and where Pip rests beside the step. */
const GAZE_PRESETS = [
  { label: "Left", x: -1, y: 0 },
  { label: "Forward", x: 0, y: 0 },
  { label: "Right", x: 1, y: 0 },
  { label: "Toward the step", x: 0.4, y: 0 },
] as const;

const JUMPS = [20_000, 5 * 60_000] as const;

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const pageClock: StageClock = {
  now: () => performance.now(),
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: (handle) => {
    window.clearTimeout(handle as number);
  },
};

/** Counts the Playground's mounts, so each one's Reaction IDs are its own. */
let mounts = 0;

/** What the live Pip inside `ref` shows: its poster, the rig, or the poster for good. */
function useRendering(ref: RefObject<HTMLElement | null>): string {
  const [rendering, setRendering] = useState("poster");
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const read = () => {
      const pip = el.querySelector("[data-pip]");
      setRendering(
        pip === null
          ? "static icon"
          : (pip.getAttribute("data-pip-rendering") ?? "poster"),
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-pip-rendering"],
    });
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return rendering;
}

/** Sets an attribute on <html> while the page shows, then puts back what was there. */
function useRootAttribute(
  name: "data-theme" | "data-motion",
  value: string | null,
) {
  useEffect(() => {
    const root = document.documentElement;
    const before = root.getAttribute(name);
    const set = (to: string | null) => {
      if (to === null) root.removeAttribute(name);
      else root.setAttribute(name, to);
    };
    set(value);
    return () => {
      set(before);
    };
  }, [name, value]);
}

function usePlaygroundDriver(): PlaygroundDriver {
  const [driver] = useState(() =>
    createPlaygroundDriver(pageClock, {
      screen: "step",
      reducedMotion: motionReduced(),
    }),
  );
  useEffect(
    () => () => {
      driver.dispose();
    },
    [driver],
  );
  return driver;
}

export function Playground() {
  const driver = usePlaygroundDriver();
  const directed = useSyncExternalStore(driver.subscribe, driver.snapshot);

  const [source, setSource] = useState<Source>("model");
  const [mode, setMode] = useState<PipMode>("idle");
  const [fired, setFired] = useState<PipModel["reaction"]>(null);
  const fireCount = useRef(0);
  const [intensity, setIntensity] = useState(1);
  const [gazeSet, setGazeSet] = useState(false);
  const [gazeX, setGazeX] = useState(0);
  const [gazeY, setGazeY] = useState(0);
  const [size, setSize] = useState<PipSize>("hero");
  // Starts from the system setting, as the app's would.
  const [reducedMotion, setReducedMotion] = useState(motionReduced);
  const [theme, setTheme] = useState<Theme>("system");
  const [rive, setRive] = useState(true);

  useRootAttribute("data-theme", theme === "system" ? null : theme);
  useRootAttribute("data-motion", reducedMotion ? "reduce" : "full");

  // The director hears reduced motion as the app's would, and takes the
  // gaze controls as where its targets sit.
  useEffect(() => {
    if (driver.snapshot().state.reducedMotion === reducedMotion) return;
    driver.send(
      { type: "reducedMotion", on: reducedMotion },
      `Reduced motion ${reducedMotion ? "on" : "off"}`,
    );
  }, [driver, reducedMotion]);
  useEffect(() => {
    driver.setTargets({ x: gazeX, y: gazeY });
  }, [driver, gazeX, gazeY]);

  const fire = (kind: PipReactionKind) => {
    fireCount.current += 1;
    setFired({ id: `model.${String(fireCount.current)}`, kind, intensity });
  };

  const model: PipModel =
    source === "model"
      ? {
          mode,
          reaction: fired,
          gaze: gazeSet ? { x: gazeX, y: gazeY } : null,
          reducedMotion,
          size,
        }
      : { ...directed.model, size };
  // The renderer plays a Reaction ID once per tab, and the tab outlives this
  // page: each mount, source and page load of the director has IDs of its own.
  const [mount] = useState(() => {
    mounts += 1;
    return mounts;
  });
  const scope = `${String(mount)}.${source === "model" ? "model" : String(directed.load)}`;

  const live = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useStageHeight(stage);
  const rendering = useRendering(live);
  const reactionKind = model.reaction?.kind ?? null;

  return (
    <div
      {...{ [PLAYGROUND_MARK]: "" }}
      className="min-h-dvh bg-bg bg-(image:--glow) bg-no-repeat text-text"
    >
      <div className="mx-auto grid max-w-[calc(var(--container-wide)+var(--container-sheet))] gap-6 px-6 pt-8 pb-24 max-sm:px-4">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PipIcon className="size-9" />
          <div className="grid gap-0.5">
            <p className="text-xs font-semibold tracking-eyebrow text-muted uppercase">
              Development only
            </p>
            <PageTitle title="Pip Playground" className="text-2xl">
              Pip Playground
            </PageTitle>
          </div>
          <p className="max-w-measure text-sm text-muted sm:ml-auto sm:text-right">
            Drive Pip&apos;s model directly, or play engine events through the
            director. Review each state beside its poster and the approved
            board.
          </p>
        </header>

        {/* Wide: the controls on the left, sticky, beside the Stage and the
            cards. Narrower: the Stage first, pinned above the controls while
            they scroll (on a screen tall enough), then the cards. */}
        <main className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[var(--container-sheet)_minmax(0,1fr)]">
          <div className="grid gap-6 lg:contents">
            <div
              ref={stage}
              className="@container min-w-0 pinned:sticky pinned:top-0 pinned:z-10 lg:col-start-2 lg:row-start-1"
            >
              <Card
                title="Stage"
                aside={
                  <span className="font-mono text-xs text-muted">
                    live: {rendering}
                  </span>
                }
              >
                <Stage>
                  <Figure
                    label="Live"
                    detail={rive ? "The rig" : "Rive unavailable"}
                  >
                    {/* A grid, so the Pip's inline box adds no line below it. */}
                    <div
                      ref={live}
                      data-playground-stage="live"
                      className="grid"
                    >
                      <PipRenderer
                        model={pipModelFor(model, "live", scope)}
                        rig={rive}
                      />
                    </div>
                  </Figure>
                  <Figure label="Fallback" detail="The poster, as without Rive">
                    <PipRenderer
                      model={pipModelFor(model, "poster", scope)}
                      rig={false}
                    />
                  </Figure>
                  <BoardFigure
                    label={`Board, ${model.mode}`}
                    crop={BOARD_FOR[model.mode][0]}
                  />
                  <BoardFigure
                    label={`Board, ${reactionKind ?? "the last Reaction"}`}
                    crop={
                      reactionKind === null
                        ? undefined
                        : BOARD_FOR[reactionKind][0]
                    }
                  />
                </Stage>
              </Card>
            </div>

            <aside
              aria-label="Controls"
              className="grid gap-4 rounded-lg border border-line bg-surface p-5 shadow-sm lg:sticky lg:top-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(var(--topbar-height)+var(--moment-height)-var(--spacing)*12)] lg:overflow-y-auto"
            >
              <Section title="Source">
                <Segmented
                  legend="What drives Pip"
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: "model", label: "The model" },
                    { value: "director", label: "The director" },
                  ]}
                />
              </Section>

              {source === "model" ? (
                <>
                  <Section title="Mode">
                    <Segmented
                      legend="The mode Pip holds"
                      value={mode}
                      onChange={setMode}
                      options={PIP_MODES.map((m) => ({
                        value: m,
                        label: capital(m),
                      }))}
                    />
                  </Section>
                  <Section
                    title="Reactions"
                    hint="Each press plays once, at the intensity below, then returns to the mode."
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      {PIP_REACTIONS.map((kind) => (
                        <Action
                          key={kind}
                          onClick={() => {
                            fire(kind);
                          }}
                          reserveDetail
                          detail={
                            fired?.kind === kind
                              ? `last at ${String(fired.intensity)}`
                              : undefined
                          }
                        >
                          {capital(kind)}
                        </Action>
                      ))}
                    </div>
                    <Slider
                      label="Intensity"
                      value={intensity}
                      min={0}
                      max={1}
                      step={0.05}
                      marks={INTENSITY_MARKS}
                      onChange={setIntensity}
                    />
                    <div
                      role="group"
                      aria-label="Intensity presets"
                      className="flex flex-wrap gap-1"
                    >
                      {INTENSITY_MARKS.map((mark) => (
                        <button
                          key={mark}
                          type="button"
                          aria-label={`Intensity ${String(mark)}`}
                          aria-pressed={intensity === mark}
                          onClick={() => {
                            setIntensity(mark);
                          }}
                          className={cx(
                            "cursor-pointer rounded-sm border px-1.5 py-0.5 font-mono text-xs tabular-nums",
                            "transition-colors duration-(--duration-fast) ease-out",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                            intensity === mark
                              ? "border-accent bg-accent-soft text-text"
                              : "border-line text-muted hover:text-text",
                          )}
                        >
                          {String(mark)}
                        </button>
                      ))}
                    </div>
                  </Section>
                </>
              ) : (
                <DirectorControls
                  driver={driver}
                  reducedMotion={reducedMotion}
                />
              )}

              <Section
                title="Gaze"
                hint={
                  source === "model"
                    ? "gazeX turns the head as well as the eyes: -1 left, 0 at the Learner, 1 right."
                    : "Where the hint, the tiers and the work sit: Explaining and Curious look there."
                }
              >
                {source === "model" && (
                  <Switch
                    label="Set the gaze"
                    detail={
                      gazeSet ? "Pip looks here" : "Off: the rig's own glances"
                    }
                    checked={gazeSet}
                    onChange={setGazeSet}
                  />
                )}
                <Slider
                  label="gazeX"
                  value={gazeX}
                  min={-1}
                  max={1}
                  step={0.05}
                  marks={[-1, 0, 1]}
                  disabled={source === "model" && !gazeSet}
                  onChange={setGazeX}
                />
                <Slider
                  label="gazeY"
                  value={gazeY}
                  min={-1}
                  max={1}
                  step={0.05}
                  marks={[-1, 0, 1]}
                  disabled={source === "model" && !gazeSet}
                  onChange={setGazeY}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  {GAZE_PRESETS.map((preset) => (
                    <Action
                      key={preset.label}
                      pressed={
                        (source === "director" || gazeSet) &&
                        gazeX === preset.x &&
                        gazeY === preset.y
                      }
                      onClick={() => {
                        setGazeSet(true);
                        setGazeX(preset.x);
                        setGazeY(preset.y);
                      }}
                      className="justify-items-center text-center"
                    >
                      {preset.label}
                    </Action>
                  ))}
                </div>
              </Section>

              <Section title="Display">
                <Segmented
                  legend="Size"
                  value={size}
                  onChange={setSize}
                  options={[
                    { value: "hero", label: "Hero" },
                    { value: "beside", label: "Beside" },
                    { value: "icon", label: "Icon" },
                  ]}
                />
                <Segmented
                  legend="Theme"
                  value={theme}
                  onChange={setTheme}
                  options={[
                    { value: "system", label: "System" },
                    { value: "dark", label: "Dark" },
                    { value: "light", label: "Light" },
                  ]}
                />
                <Switch
                  label="Reduced motion"
                  detail={
                    source === "director"
                      ? "The director rests Pip"
                      : "Each Reaction by expression alone"
                  }
                  checked={reducedMotion}
                  onChange={setReducedMotion}
                />
                <Switch
                  label="Rive available"
                  detail={
                    rive
                      ? "The rig takes over"
                      : "Rive unavailable: posters only"
                  }
                  checked={rive}
                  onChange={setRive}
                />
              </Section>
            </aside>
          </div>

          <div className="@container grid min-w-0 gap-6 lg:col-start-2 lg:row-start-2">
            <div className="grid items-start gap-6 wide:grid-cols-2">
              <Card title="Model">
                <ModelReadout
                  model={model}
                  rendering={rendering}
                  screenSize={
                    source === "director" ? directed.model.size : undefined
                  }
                />
              </Card>
              <Card title="Sizes">
                {/* One row where the three fit; on a phone, Hero above the other two. */}
                <div className="grid grid-cols-[auto_auto_auto] items-end justify-around gap-4 narrow:grid-cols-2">
                  <Figure
                    label="Hero"
                    detail={`${String(PIP_SIZES.hero)} px`}
                    className="narrow:col-span-2"
                  >
                    <PipRenderer
                      model={pipModelFor(
                        { ...model, size: "hero" },
                        "hero",
                        scope,
                      )}
                      rig={rive}
                    />
                  </Figure>
                  <Figure
                    label="Beside"
                    detail={`${String(PIP_SIZES.beside)} px`}
                    compact
                  >
                    <PipRenderer
                      model={pipModelFor(
                        { ...model, size: "beside" },
                        "beside",
                        scope,
                      )}
                      rig={rive}
                    />
                  </Figure>
                  <Figure label="Icon" detail="Static SVG" compact>
                    <PipRenderer model={{ ...model, size: "icon" }} />
                  </Figure>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-line pt-4">
                  <PipIcon className="size-16" />
                  <PipIcon className="size-8" />
                  <PipIcon className="size-4" />
                  <BoardImage
                    crop={ICONS}
                    maxHeight={64}
                    label={`The board's ${ICONS.caption}`}
                  />
                </div>
              </Card>
            </div>

            {source === "director" && (
              <Card
                title="Director"
                aside={
                  <span className="font-mono text-xs text-muted">
                    page load {String(directed.load)}
                  </span>
                }
              >
                <DirectorLog log={directed.log} />
              </Card>
            )}

            <Card title="The approved board">
              <BoardSections />
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

/** The board, section by section, or a calm note where it is not on this machine. */
function BoardSections() {
  const board = useBoard();
  if (board === "missing") {
    return (
      <div
        data-playground-board="missing"
        className="grid gap-1 rounded-md border border-dashed border-line-2 px-4 py-6 text-center"
      >
        <p className="text-sm font-medium">Board not available</p>
        <p className="mx-auto max-w-measure text-xs text-muted">
          The approved board is private and never committed. The dev server
          reads it from
          .scratch/claude-code-quest/assets/pip-approved-board.png, or from the
          file PIP_BOARD names.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      {BOARD_SECTIONS.map((section) => (
        <div key={section.title} className="grid gap-2">
          <h3 className="text-sm font-semibold text-muted">{section.title}</h3>
          <div className="flex flex-wrap items-end gap-3">
            {section.crops.map((crop) => (
              <figure key={crop.id} className="grid min-w-0 gap-1">
                <BoardImage
                  crop={crop}
                  maxHeight={144}
                  label={`Pip: ${crop.caption}`}
                />
                <figcaption className="text-xs text-muted">
                  {crop.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid content-start gap-4 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Figure({
  label,
  detail,
  compact = false,
  className,
  children,
}: {
  label: string;
  detail: string;
  /** Drops the hero's height where the figure sits on a row of its own size. */
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure
      className={cx("grid min-w-0 justify-items-center gap-2", className)}
    >
      <div
        className={cx(
          "grid min-h-52 place-items-center",
          compact && "narrow:min-h-0",
        )}
      >
        {children}
      </div>
      <figcaption className="grid justify-items-center text-center">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted">{detail}</span>
      </figcaption>
    </figure>
  );
}

function BoardFigure({
  label,
  crop,
}: {
  label: string;
  crop: BoardCrop | undefined;
}) {
  return (
    <Figure label={label} detail={crop?.caption ?? "Play one to compare"}>
      {crop === undefined ? (
        <div className="grid size-52 max-w-full place-items-center rounded-md border border-dashed border-line-2 text-xs text-muted">
          No Reaction yet
        </div>
      ) : (
        <BoardImage
          crop={crop}
          maxHeight={208}
          label={`The board's ${crop.caption}`}
        />
      )}
    </Figure>
  );
}

function useBoard() {
  return useSyncExternalStore(subscribeBoard, boardState);
}

/**
 * One crop of the board, cut from it in the browser: an SVG whose view box is
 * the crop, at the board's own pixels up to `maxHeight`. A dashed box of the
 * same size stands in while the board loads, or where it is not available.
 */
function BoardImage({
  crop,
  maxHeight,
  label,
}: {
  crop: BoardCrop;
  maxHeight: number;
  label: string;
}) {
  const board = useBoard();
  const scale = Math.min(1, maxHeight / crop.height);
  const box = {
    width: crop.width * scale,
    aspectRatio: `${String(crop.width)} / ${String(crop.height)}`,
  };
  if (board !== "ready") {
    return (
      <span
        data-playground-board={board}
        style={box}
        className="grid max-w-full place-items-center rounded-md border border-dashed border-line-2 p-2 text-center text-xs text-muted"
      >
        {board === "missing" ? "Board not available" : null}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      style={box}
      className="block max-w-full overflow-hidden rounded-md border border-line"
    >
      <svg
        aria-hidden="true"
        viewBox={`${String(crop.x)} ${String(crop.y)} ${String(crop.width)} ${String(crop.height)}`}
        className="block size-full"
      >
        <image
          href={BOARD_URL}
          width={BOARD_SIZE.width}
          height={BOARD_SIZE.height}
        />
      </svg>
    </span>
  );
}

/**
 * The Stage's four figures: two by two, four in a row when wide, and on a
 * phone one row that scrolls sideways, so each Pip keeps its real size.
 */
function Stage({ children }: { children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const scrolls = useScrolls(row);
  return (
    <div
      ref={row}
      data-playground-stage-row=""
      // A row that scrolls is a Tab stop, so the keyboard can scroll it too.
      {...(scrolls
        ? { tabIndex: 0, role: "region", "aria-label": "Stage figures" }
        : {})}
      className={cx(
        "grid grid-cols-2 gap-x-3 gap-y-4 wide:grid-cols-4",
        "narrow:grid-flow-col narrow:grid-cols-none narrow:auto-cols-52 narrow:snap-x narrow:snap-mandatory narrow:overflow-x-auto narrow:overscroll-x-contain narrow:pb-1 narrow:*:snap-start",
        "rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Keeps the Stage's height in `--playground-stage` on <html>, so where the
 * Stage is pinned, a control the keyboard focuses scrolls into view below it
 * rather than under it (playground.css).
 */
function useStageHeight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (el === null || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() => {
      root.setProperty("--playground-stage", `${String(el.offsetHeight)}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty("--playground-stage");
    };
  }, [ref]);
}

/** Whether the element's content is wider than it, so it scrolls sideways. */
function useScrolls(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = ref.current;
    // jsdom has no ResizeObserver; every browser the app supports does.
    if (el === null || typeof ResizeObserver === "undefined") return;
    const read = () => {
      setScrolls(el.scrollWidth > el.clientWidth + 1);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return scrolls;
}

function ModelReadout({
  model,
  rendering,
  screenSize,
}: {
  model: PipModel;
  rendering: string;
  /** The size the director gives the screen, which the Size control overrides. */
  screenSize: PipSize | undefined;
}) {
  const rows: [string, string][] = [
    ["mode", model.mode],
    [
      "reaction",
      model.reaction === null
        ? "null"
        : `${model.reaction.kind} at ${String(model.reaction.intensity)}`,
    ],
    [
      "gaze",
      model.gaze === null
        ? "null"
        : `${model.gaze.x.toFixed(2)}, ${model.gaze.y.toFixed(2)}`,
    ],
    ["reducedMotion", String(model.reducedMotion)],
    [
      "size",
      screenSize === undefined || screenSize === model.size
        ? model.size
        : `${model.size} (the screen's: ${screenSize})`,
    ],
    ["live Pip", rendering],
  ];
  return (
    <dl
      data-playground-model=""
      className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 font-mono text-sm"
    >
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-muted">{name}</dt>
          <dd data-field={name}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DirectorControls({
  driver,
  reducedMotion,
}: {
  driver: PlaygroundDriver;
  reducedMotion: boolean;
}) {
  const { state, playing } = useSyncExternalStore(
    driver.subscribe,
    driver.snapshot,
  );
  const screenId = "playground-screen";
  return (
    <>
      <Section
        title="Scenarios"
        hint="Each starts a new page load and plays its events on real time."
      >
        <div className="grid gap-1.5">
          {SCENARIOS.map((scenario) => (
            <Action
              key={scenario.id}
              pressed={playing === scenario.id}
              detail={scenario.summary}
              onClick={() => {
                driver.play(scenario, { reducedMotion });
              }}
              className="[&>span:last-child]:whitespace-normal"
            >
              {scenario.name}
            </Action>
          ))}
        </div>
      </Section>
      <Section
        title="Events"
        hint="Each press is one revision with one event, through the Reaction map."
      >
        {EVENT_GROUPS.map((group) => (
          <div key={group.title} className="grid gap-1.5">
            <h3 className="text-sm text-muted">{group.title}</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {group.choices.map((choice) => {
                const earned = reactionFor(
                  [
                    {
                      id: choice.id,
                      revision: 0,
                      serverTime: 0,
                      ...choice.event,
                    },
                  ],
                  { glanceReady: true },
                );
                return (
                  <Action
                    key={choice.id}
                    detail={[
                      choice.note,
                      earned === null
                        ? undefined
                        : `${earned.kind} ${String(earned.intensity)}`,
                    ]
                      .filter((part) => part !== undefined)
                      .join(", ")}
                    onClick={() => {
                      driver.events([choice.event]);
                    }}
                  >
                    {choice.event.type}
                  </Action>
                );
              })}
            </div>
          </div>
        ))}
      </Section>
      <Section title="The browser">
        <label htmlFor={screenId} className="grid gap-1.5 text-sm text-muted">
          Screen
        </label>
        <select
          id={screenId}
          value={state.screen}
          onChange={(event) => {
            const screen = SCREENS.find((s) => s === event.currentTarget.value);
            if (screen !== undefined)
              driver.send({ type: "screen", screen }, `Screen: ${screen}`);
          }}
          className="-mt-2 h-9 w-full cursor-pointer rounded-md border border-line-2 bg-surface-2 px-2 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {SCREENS.map((screen) => (
            <option key={screen} value={screen}>
              {screen}
            </option>
          ))}
        </select>
        <Switch
          label="Lesson page panel open"
          checked={state.pagePanelOpen}
          onChange={(open) => {
            driver.send(
              { type: "pagePanel", open },
              `Page panel ${open ? "opened" : "closed"}`,
            );
          }}
        />
        <Switch
          label="Page hidden"
          checked={state.hidden}
          onChange={(hidden) => {
            driver.send(
              { type: "visibility", hidden },
              hidden ? "Page hidden" : "Page shown",
            );
          }}
        />
        <Switch
          label="Pip off-screen"
          checked={state.offScreen}
          onChange={(off) => {
            driver.send(
              { type: "onScreen", visible: !off },
              off ? "Pip scrolled away" : "Pip back on screen",
            );
          }}
        />
        <Switch
          label="Reconnecting"
          checked={state.connectionLost}
          onChange={(lost) => {
            driver.send(
              { type: "connection", lost },
              lost ? "Reconnecting" : "Connected again",
            );
          }}
        />
      </Section>
      <Section
        title="Clock"
        hint="Jump the director's clock ahead, or start a new page load."
      >
        <div className="grid grid-cols-3 gap-1.5">
          {JUMPS.map((ms) => (
            <Action
              key={ms}
              onClick={() => {
                driver.jump(ms, `The clock jumps ${durationText(ms)} ahead`);
              }}
            >
              {`+${durationText(ms)}`}
            </Action>
          ))}
          <Action
            onClick={() => {
              driver.reload({ screen: state.screen, reducedMotion });
            }}
          >
            New page load
          </Action>
        </div>
      </Section>
    </>
  );
}

const OUTCOME_MARK: Readonly<Record<Outcome, string>> = {
  plays: "bg-accent",
  nod: "bg-teal",
  waits: "bg-wait",
  dropped: "bg-mark",
  none: "bg-line-2",
};

function DirectorLog({ log }: { log: readonly LogEntry[] }) {
  return (
    <ol
      role="log"
      aria-label="What the director did"
      className="grid max-h-80 gap-1 overflow-y-auto"
    >
      {log.map((entry) => (
        <li
          key={entry.n}
          data-outcome={entry.outcome}
          className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-3 rounded-sm px-1 py-0.5 text-sm max-sm:grid-cols-[auto_minmax(0,1fr)]"
        >
          <span className="font-mono text-xs text-muted tabular-nums">
            {`+${(entry.at / 1000).toFixed(1)} s`}
          </span>
          <span className="flex items-baseline gap-2 font-mono text-xs">
            <span
              aria-hidden="true"
              className={cx(
                "size-2 shrink-0 translate-y-px rounded-full",
                OUTCOME_MARK[entry.outcome],
              )}
            />
            {entry.input}
          </span>
          <span className="text-text max-sm:col-start-2">{entry.result}</span>
        </li>
      ))}
    </ol>
  );
}
