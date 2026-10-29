import { PipPlaceholder } from "../components/PipPlaceholder";
import { cx } from "../lib/cx";
import { PipIcon } from "./PipIcon";

/** Pip's three on-screen sizes, as the renderer contract names them. */
export type PipDisplaySize = "hero" | "beside" | "icon";

export interface PipProps {
  size: PipDisplaySize;
  className?: string | undefined;
}

/**
 * Pip at one of its sizes. The icon size is always the static icon, 24 px
 * here, and never the rig; the larger sizes show the placeholder until Pip's
 * renderer lands.
 */
export function Pip({ size, className }: PipProps) {
  if (size === "icon") return <PipIcon className={cx("size-6", className)} />;
  return <PipPlaceholder size={size} className={className} />;
}
