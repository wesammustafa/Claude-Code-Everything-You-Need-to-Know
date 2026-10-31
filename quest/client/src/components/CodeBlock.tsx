import { useRef } from "react";
import type { CodeView } from "@quest/contract";
import { cx } from "../lib/cx";
import { Icon } from "./Icon";
import { useCopy } from "./useCopy";

export interface CodeBlockProps {
  code: CodeView;
}

/**
 * A code block the beat explains: the window of it the beat shows, each line
 * under its number in the whole block (a long line wraps under its own
 * number), the explained line marked, and one Copy for the whole block.
 */
export function CodeBlock({ code }: CodeBlockProps) {
  const block = useRef<HTMLElement>(null);
  const { state: copied, copies, label, copy } = useCopy(block);

  return (
    <div
      data-pip-target="command"
      data-code-block=""
      className="grid w-full gap-1 rounded-md border border-code-line bg-code-bg py-2 pr-1.5 pl-2 text-code-text"
    >
      <code
        ref={block}
        className="grid font-mono text-control whitespace-pre-wrap"
      >
        {code.lines.map((line) => {
          const point = line.n === code.point;
          return (
            <span
              key={line.n}
              data-line={line.n}
              {...(point ? { "data-point": "" } : {})}
              className={cx(
                "grid grid-cols-[3ch_1fr] gap-3 rounded-sm px-1",
                point && "bg-code-control",
              )}
            >
              <span
                className="justify-self-end text-code-muted select-none"
                aria-hidden="true"
              >
                {line.n}
              </span>
              <span className="min-w-0 wrap-anywhere">
                {point && <span className="sr-only">explained line: </span>}
                {line.text}
              </span>
            </span>
          );
        })}
      </code>
      <button
        type="button"
        onClick={() => void copy(code.copy)}
        aria-label={copied === "idle" ? "Copy the code" : label}
        className={cx(
          "inline-flex h-7.5 cursor-pointer items-center gap-1.5 justify-self-end rounded-sm border border-transparent bg-code-control px-2.5 font-sans text-xs font-semibold text-code-text",
          "transition-[background-color,translate,scale] duration-(--duration-fast) ease-out",
          "hover:bg-code-control-hover active:duration-(--duration-press) active:translate-y-(--press-y) active:scale-(--press-scale)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-code",
        )}
      >
        <Icon
          key={`${copied}-${String(copies)}`}
          name={copied === "idle" ? "copy" : "check"}
          size="sm"
          className={copied === "idle" ? undefined : "animate-pop"}
        />
        <span aria-hidden="true">{label}</span>
      </button>
      <span role="status" className="sr-only">
        {copied !== "idle" && (
          <span key={copies}>
            {copied === "copied"
              ? "Copied"
              : "Selected: copy it with your keyboard"}
          </span>
        )}
      </span>
    </div>
  );
}
