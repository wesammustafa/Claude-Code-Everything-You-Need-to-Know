import { useEffect, useState, type RefObject } from "react";
import { usePipLook } from "../pip/PipStage";

/** How long "Copied" shows before the button reads "Copy" again. */
const CONFIRM_FOR_MS = 1600;

export type CopyState = "idle" | "copied" | "selected";

/**
 * Copy for a code element: the clipboard where it is there, else the
 * element's contents selected so the keyboard can copy them. Either way Pip,
 * if the screen has one, looks at the element for a moment. `copies` counts
 * every Copy, so each one restarts the confirmation and is announced again.
 */
export function useCopy(node: RefObject<HTMLElement | null>): {
  state: CopyState;
  copies: number;
  label: string;
  copy: (text: string) => Promise<void>;
} {
  const [state, setState] = useState<CopyState>("idle");
  const [copies, setCopies] = useState(0);
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

  const select = () => {
    const el = node.current;
    const selection = window.getSelection();
    if (!el || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    confirm("selected");
  };

  const copy = async (text: string) => {
    look("command", node.current);
    try {
      // The Clipboard API is missing outside a secure context.
      if (!("clipboard" in navigator)) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      confirm("copied");
    } catch {
      select();
    }
  };

  const label =
    state === "copied" ? "Copied" : state === "selected" ? "Selected" : "Copy";

  return { state, copies, label, copy };
}
