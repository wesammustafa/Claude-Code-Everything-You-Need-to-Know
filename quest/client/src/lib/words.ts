// Small text helpers for words the Guide writes once and the app shows in
// several places: a sentence's first letter, and a skill's readable name.

// A lowercase first letter, plain or after an opening **bold** mark. A line
// that opens with a `code` span, a link or a capital stays as written.
const FIRST = /^(\*\*)?([a-z])/;

// A quote cut where the page's sentence went on: a colon, semicolon or
// comma at its end, which a line of its own closes with a full stop.
const OPEN_END = /\s*[:;,]$/;

/** The text with its first letter capitalized and an open end closed, so a fragment the Guide wrote to follow a lead-in reads as a line of its own. */
export function sentence(text: string): string {
  return text
    .replace(
      FIRST,
      (_, bold: string | undefined, letter: string) =>
        `${bold ?? ""}${letter.toUpperCase()}`,
    )
    .replace(OPEN_END, ".");
}

// Names a line may open with that keep their capital after a lead-in.
const PROPER = new Set([
  "Claude",
  "GitHub",
  "Chrome",
  "Codespaces",
  "Git",
  "Node",
]);

/**
 * The text as the rest of a sentence that a lead-in such as "you can" opens:
 * a capital that only started the line is lowered, a proper name or an
 * initialism keeps it, and a full stop at the end is dropped for the lead-in's own.
 */
export function afterLeadIn(text: string): string {
  const trimmed = text.replace(/\.\s*$/, "");
  const first = /^([A-Z][a-z]+)(?![A-Za-z])/.exec(trimmed)?.[1];
  if (first === undefined || PROPER.has(first)) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

// Skill ids are kebab-case keys in the step files; a few are initialisms.
const INITIALISMS: Record<string, string> = {
  ci: "CI",
  gh: "GitHub",
  mcp: "MCP",
  tdd: "TDD",
};

/** A skill id as a readable label: `review-diff` reads "Review diff", `gh-secret` reads "GitHub secret". */
export function skillLabel(id: string): string {
  const words = id
    .split("-")
    .map((word) => INITIALISMS[word] ?? word)
    .join(" ");
  return sentence(words);
}
