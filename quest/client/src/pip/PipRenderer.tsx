import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PipModel } from "../../pip/contract";
import { POSTER_POSES, type PosterPose } from "../../pip/posters";
import { cx } from "../lib/cx";
import { usePageHidden } from "../lib/page";
import { afterFirstPaint } from "../lib/paint";
import { PipIcon } from "./PipIcon";
import { reactionLedger } from "./playback";
import { posterPose, posterUrl, type RigSize } from "./rig";
import {
  loadPipRuntime,
  settledPipRuntime,
  subscribePipRuntime,
  type PipRuntime,
} from "./runtime";

// Pip's box at each size, in spacing units: 76 and 208 px, the posters' own
// sizes (pip/posters.ts), so a poster and the rig sit in exactly one place.
const BOX: Readonly<Record<RigSize, string>> = {
  beside: "size-19",
  hero: "size-52",
};

const POSES = Object.keys(POSTER_POSES) as PosterPose[];

/** Which picture Pip shows: its poster while the rig loads, the rig, or the poster for good. */
export type PipRendering = "poster" | "rig" | "unavailable";

export interface PipRendererProps {
  model: PipModel;
  className?: string | undefined;
  /** Pip scrolled into view or out of it. */
  onScreenChange?: ((visible: boolean) => void) | undefined;
}

/**
 * Pip drawn from one PipModel. The icon size is always the static SVG. The
 * larger sizes paint the poster for the current mode or Reaction at once;
 * after the first paint the Rive runtime loads, and once the rig has drawn a
 * frame it fades in over the poster. Wherever Rive fails, the poster stays;
 * if the rig's WebGL context is lost, the poster fades back until the
 * runtime is running again.
 * Decorative throughout: the bubble's text carries the meaning.
 */
export function PipRenderer({
  model,
  className,
  onScreenChange,
}: PipRendererProps) {
  if (model.size === "icon")
    return <PipIcon className={cx("size-6", className)} />;
  return (
    <RigPip
      model={model}
      size={model.size}
      className={className}
      onScreenChange={onScreenChange}
    />
  );
}

interface RigPipProps extends Omit<PipRendererProps, "model"> {
  model: PipModel;
  size: RigSize;
}

function RigPip({ model, size, className, onScreenChange }: RigPipProps) {
  const box = useRef<HTMLSpanElement>(null);
  const runtime = useSyncExternalStore(subscribePipRuntime, settledPipRuntime);
  const file = runtime?.file ?? null;
  // The file the rig drew a frame of, and the one it failed on: a runtime
  // that comes back after a lost context starts again from the poster.
  const [drawn, setDrawn] = useState<PipRuntime["file"] | null>(null);
  const [failed, setFailed] = useState<PipRuntime["file"] | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [started, setStarted] = useState<string | null>(null);
  const hidden = usePageHidden();

  // The runtime loads after the page's first contentful paint; a Pip that
  // mounts later finds it settled already.
  useEffect(() => {
    if (runtime !== undefined) return;
    return afterFirstPaint(() => {
      void loadPipRuntime();
    });
  }, [runtime]);

  // Whether Pip is on screen, for pausing the rig and for the director.
  const screenChange = useRef(onScreenChange);
  useEffect(() => {
    screenChange.current = onScreenChange;
  }, [onScreenChange]);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      setOnScreen(entry.isIntersecting);
      screenChange.current?.(entry.isIntersecting);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  // The Reaction's poster holds for a moment from its arrival, in this tab's
  // ledger, so a Pip mounting on the next screen shows the same picture.
  const reaction = model.reaction;
  useLayoutEffect(() => {
    if (reaction !== null) reactionLedger.arrive(reaction.id);
  }, [reaction]);
  const holding = useSyncExternalStore(reactionLedger.subscribe, () =>
    reaction === null ? false : reactionLedger.holding(reaction.id),
  );
  const pose = posterPose(model, holding);

  const rigFailed = file !== null && failed === file;
  const rigShown = file !== null && drawn === file && !rigFailed;
  // The posters Pip has shown so far. A pose joins only while the poster is
  // what the Learner sees, so the rig never fetches a poster it won't show.
  const [poses, setPoses] = useState<readonly PosterPose[]>([pose]);
  if (!rigShown && !poses.includes(pose)) setPoses([...poses, pose]);

  const onDrawn = useCallback(() => {
    setDrawn(file);
  }, [file]);
  const onFailed = useCallback(() => {
    setFailed(file);
  }, [file]);
  const onReaction = useCallback((id: string) => {
    setStarted(id);
  }, []);

  const rendering: PipRendering =
    runtime === null || rigFailed ? "unavailable" : rigShown ? "rig" : "poster";

  // While Pip shows its poster for good, the poster shows each Reaction that
  // comes, so a rig that comes back later never replays one.
  useLayoutEffect(() => {
    if (reaction !== null && rendering === "unavailable")
      reactionLedger.spend(reaction.id);
  }, [reaction, rendering]);
  // Only the poster's own Reaction counts as started when the rig is not drawing.
  const shownReaction =
    rendering === "rig" ? started : holding ? (reaction?.id ?? null) : null;

  return (
    <span
      ref={box}
      aria-hidden="true"
      data-pip={size}
      data-pip-rendering={rendering}
      data-pip-playing={String(rigShown && onScreen && !hidden)}
      data-pip-reaction={shownReaction ?? undefined}
      className={cx("relative inline-block shrink-0", BOX[size], className)}
    >
      {/* The posters Pip has shown, stacked; the current one is opaque and
          the rest fade out, so a change of pose crossfades. */}
      {POSES.filter((p) => poses.includes(p)).map((p) => (
        <img
          key={p}
          src={posterUrl(p, size)}
          alt=""
          draggable={false}
          data-pip-poster={p}
          className={cx(
            "absolute inset-0 size-full select-none",
            "transition-opacity duration-(--duration-base) ease-out",
            p === pose && !rigShown ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      {runtime != null && !rigFailed && (
        <span
          className={cx(
            "absolute inset-0",
            "transition-opacity duration-(--duration-base) ease-out",
            rigShown ? "opacity-100" : "opacity-0",
          )}
        >
          <runtime.PipRive
            file={runtime.file}
            model={model}
            active={onScreen && !hidden}
            onDrawn={onDrawn}
            onFailed={onFailed}
            onReaction={onReaction}
          />
        </span>
      )}
    </span>
  );
}
