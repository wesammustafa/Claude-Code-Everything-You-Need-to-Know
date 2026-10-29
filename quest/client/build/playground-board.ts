// The Pip Playground shows Pip's approved board beside the rig. The board is
// the owner's private art: it is never committed and never built. The dev
// server alone serves it, read from where the owner keeps it, and the
// Playground cuts each crop from it in the browser (src/playground/board.ts).
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";

/** Where the Playground asks for the board. Only the dev server answers. */
export const BOARD_PATH = "/@playground/board.png";

/** The board's place under the repo's private, gitignored `.scratch/` folder. */
const SCRATCH_BOARD =
  ".scratch/claude-code-quest/assets/pip-approved-board.png";

/**
 * The board file: `PIP_BOARD` when set, or else the first
 * `.scratch/.../pip-approved-board.png` above `from` (so a worktree inside
 * the repo finds the checkout's). Undefined when there is none.
 */
export function findBoard(
  from: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const set = env.PIP_BOARD;
  if (set !== undefined && set !== "") {
    const file = resolve(set);
    return existsSync(file) && statSync(file).isFile() ? file : undefined;
  }
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const file = join(dir, SCRATCH_BOARD);
    if (existsSync(file)) return file;
    if (dirname(dir) === dir) return undefined;
  }
}

/**
 * Serves the board at BOARD_PATH, during `npm run dev` only, or answers 404
 * when it is not there. The board is looked up on each request, so adding it
 * needs no restart.
 */
export function playgroundBoard(root: string): Plugin {
  return {
    name: "quest:playground-board",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(BOARD_PATH, (_req, res) => {
        const file = findBoard(root);
        if (file === undefined) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "image/png");
        res.end(readFileSync(file));
      });
    },
  };
}
