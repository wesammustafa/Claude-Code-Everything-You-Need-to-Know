import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx";
import { usePipLook } from "../pip/PipStage";
import { Icon } from "./Icon";

/** How long "Copied" shows before the button reads "Copy" again. */
const CONFIRM_FOR_MS = 1600;

type CopyState = "idle" | "copied" | "selected";

// The command split at its spaces, each space kept, so a line wraps only
// between arguments: a break inside one ("b-" over "1") would mislead a
// Learner who types it by eye.
function words(text: string): string[] {
  return text.split(/( +)/).filter((part) => part !== "");
}

export interface CommandProps {
  /** The command exactly as the Learner types it. */
  text: string;
  /** Sit at the command's own width, inline with text, rather than fill the line. */
  fit?: boolean;
  className?: string;
}

/**
 * A command to type in the terminal, with a Copy button. Where the clipboard
 * is unavailable, Copy selects the command so the keyboard can copy it.
 * Either way Pip, if the screen has one, looks at the command for a moment.
 */
export function Command({ text, fit = false, className }: CommandProps) {
  const [state, setState] = useState<CopyState>("idle");
  // Counts every Copy, so each one restarts the confirmation and is announced again.
  const [copies, setCopies] = useState(0);
  const code = useRef<HTMLElement>(null);
  const look = usePipLook();

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => {
      setState("idle");
    }, CONFIRM_FOR_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state, copies]);

  const confirm = (next: Exclude<CopyState, "idle">) => {
    setState(next);
    setCopies((n) => n + 1);
  };

  const selectCommand = () => {
    const node = code.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
    confirm("selected");
  };

  const copy = async () => {
    look("command", code.current);
    try {
      // The Clipboard API is missing outside a secure context.
      if (!("clipboard" in navigator)) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      confirm("copied");
    } catch {
      selectCommand();
    }
  };

  const label =
    state === "copied" ? "Copied" : state === "selected" ? "Selected" : "Copy";

  return (
    <div
      data-pip-target="command"
      className={cx(
        "flex items-center gap-2.5 rounded-md border border-code-line bg-code-bg py-1.5 pr-1.5 pl-4 text-code-text",
        // One width class only: a second one would win by Tailwind's order, not by intent.
        fit ? "w-fit max-w-full" : "w-full",
        className,
      )}
    >
      <span
        className="font-mono text-control text-code-muted select-none"
        aria-hidden="true"
      >
        $
      </span>
      <code
        ref={code}
        className="min-w-0 flex-1 py-1.5 font-mono text-control whitespace-pre-wrap"
      >
        {words(text).map((part, i) =>
          part.startsWith(" ") ? (
            part
          ) : (
            // An argument wider than the line still wraps, anywhere, rather than overflow.
            <span
              key={`${String(i)}-${part}`}
              className="inline-block max-w-full wrap-anywhere"
            >
              {part}
            </span>
          ),
        )}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={state === "idle" ? `Copy ${text}` : label}
        className={cx(
          "inline-flex h-7.5 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-transparent bg-code-control px-2.5 font-sans text-xs font-semibold text-code-text",
          "transition-[background-color,translate,scale] duration-(--duration-fast) ease-out",
          "hover:bg-code-control-hover active:duration-(--duration-press) active:translate-y-(--press-y) active:scale-(--press-scale)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-on-code",
        )}
      >
        <Icon
          key={`${state}-${String(copies)}`}
          name={state === "idle" ? "copy" : "check"}
          size="sm"
          className={state === "idle" ? undefined : "animate-pop"}
        />
        <span aria-hidden="true">{label}</span>
      </button>
      <span role="status" className="sr-only">
        {state !== "idle" && (
          // A new node for each Copy, so a repeat is announced, not dropped as unchanged.
          <span key={copies}>
            {state === "copied"
              ? "Copied"
              : "Selected: copy it with your keyboard"}
          </span>
        )}
      </span>
    </div>
  );
}
