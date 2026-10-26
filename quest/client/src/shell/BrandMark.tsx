import { PipPlaceholder } from "../components/PipPlaceholder";

/** The brand in the top bar: a placeholder mark until Pip's icon replaces it. */
export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <PipPlaceholder size="icon" />
      <span className="text-control font-bold tracking-tight max-sm:sr-only">
        Claude Code Quest
      </span>
    </span>
  );
}
