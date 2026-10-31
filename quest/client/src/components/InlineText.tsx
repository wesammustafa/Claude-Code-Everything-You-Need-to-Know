import type { ReactNode } from "react";
import { usePagePanel } from "../pages/PagePanel";

export const CODE =
  "rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-code font-normal tracking-normal";

// One span at a time: `code`, **bold** or [text](url). Everything else is
// text, so the Guide's words reach the page as text nodes, never as HTML.
const SPAN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
// A repository page, such as `beginner/02-first-session.md#why`: it opens
// in the page panel. Anything with a scheme, a leading slash or a ./ or
// ../ start does not: the panel takes paths from the repository root.
const PAGE = /^(?![a-z][a-z0-9+.-]*:)(?!\/)(?!\.\.?\/)([^#]+\.md)(?:#(.+))?$/i;

/** Text with the Guide's inline marks: `code`, **bold** and [links](url). */
export function InlineText({ text }: { text: string }) {
  const { open } = usePagePanel();
  return text.split(SPAN).map((part, i): ReactNode => {
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className={CODE}>
          {part.slice(1, -1)}
        </code>
      );
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = LINK.exec(part);
    if (link) {
      const [, label = "", href = ""] = link;
      const page = PAGE.exec(href);
      if (page) {
        const [, path = "", fragment] = page;
        return (
          <a
            key={i}
            href={href}
            onClick={(event) => {
              event.preventDefault();
              open(path, fragment);
            }}
          >
            {label}
          </a>
        );
      }
      // Only a web link leaves the page: any other scheme stays text.
      if (!/^https?:\/\//i.test(href)) return <span key={i}>{label}</span>;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
