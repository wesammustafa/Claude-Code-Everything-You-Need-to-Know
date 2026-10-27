import { useCallback, useEffect } from "react";
import type { PipModel } from "../../pip/contract";
import { cx } from "../lib/cx";
import { PipIcon } from "./PipIcon";
import { PipRenderer } from "./PipRenderer";
import { usePipFollowsPointer, usePipInput, usePipModel } from "./PipStage";

export interface PipProps {
  /** Where the screen puts Pip; `icon` is always the static SVG. */
  size: PipModel["size"];
  className?: string | undefined;
}

/**
 * Pip at one of its sizes. The icon size is always the static icon, 24 px
 * here, and never the rig. The larger sizes draw the page's director's model
 * at the size the screen gives, tell the director when Pip scrolls out of
 * view or leaves the screen, and follow the mouse.
 */
export function Pip({ size, className }: PipProps) {
  if (size === "icon") return <PipIcon className={cx("size-6", className)} />;
  return <StagedPip size={size} className={className} />;
}

function StagedPip({
  size,
  className,
}: {
  size: Exclude<PipModel["size"], "icon">;
  className: string | undefined;
}) {
  const model = usePipModel();
  const send = usePipInput();
  usePipFollowsPointer();
  const onScreenChange = useCallback(
    (visible: boolean) => {
      send({ type: "onScreen", visible });
    },
    [send],
  );
  // A Pip arriving with its screen is taken as seen until the observer says
  // otherwise, so a screen change never rests Pip for a frame; a Pip that
  // leaves with its screen can no longer be seen.
  useEffect(() => {
    send({ type: "onScreen", visible: true });
    return () => {
      send({ type: "onScreen", visible: false });
    };
  }, [send]);
  return (
    <PipRenderer
      model={{ ...model, size }}
      className={className}
      onScreenChange={onScreenChange}
    />
  );
}
