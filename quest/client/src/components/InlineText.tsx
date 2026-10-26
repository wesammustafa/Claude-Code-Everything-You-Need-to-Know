/** Text with `backtick` spans shown as inline code, as the Guide writes them. */
export function InlineText({ text }: { text: string }) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code
        key={i}
        className="rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-code font-normal tracking-normal"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
