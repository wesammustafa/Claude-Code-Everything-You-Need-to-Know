import { Pip } from "../pip/Pip";

/** The brand in the top bar: Pip's icon and the app's name. */
export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Pip size="icon" />
      <span className="text-control font-bold tracking-tight max-sm:sr-only">
        Claude Code Quest
      </span>
    </span>
  );
}
