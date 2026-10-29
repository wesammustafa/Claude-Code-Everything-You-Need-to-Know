// @vitest-environment node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { BOARD_PATH, findBoard } from "./playground-board";

const scratch = fileURLToPath(new URL("../dist/", import.meta.url));
const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function tree(): string {
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, "board-test-"));
  temps.push(root);
  return root;
}

describe("finding the Playground's board", () => {
  test("finds it under .scratch in a folder above, as a worktree inside the repo does", () => {
    const root = tree();
    const board = join(
      root,
      ".scratch/claude-code-quest/assets/pip-approved-board.png",
    );
    mkdirSync(join(board, ".."), { recursive: true });
    writeFileSync(board, "png");
    const deep = join(root, ".claude/worktrees/x/quest/client");
    mkdirSync(deep, { recursive: true });
    expect(findBoard(deep, {})).toBe(board);
  });

  test("takes PIP_BOARD first, and only when that file is there", () => {
    const root = tree();
    const file = join(root, "board.png");
    writeFileSync(file, "png");
    expect(findBoard(root, { PIP_BOARD: file })).toBe(file);
    expect(
      findBoard(root, { PIP_BOARD: join(root, "missing.png") }),
    ).toBeUndefined();
  });

  test("finds nothing where there is no board", () => {
    // Outside the repo, so no .scratch folder is above it.
    const root = mkdtempSync(join(tmpdir(), "board-test-"));
    temps.push(root);
    expect(findBoard(root, { PIP_BOARD: "" })).toBeUndefined();
  });
});

test("the Playground asks for the board where the dev server serves it", () => {
  const board = readFileSync(
    new URL("../src/playground/board.ts", import.meta.url),
    "utf8",
  );
  expect(board).toContain(`export const BOARD_URL = "${BOARD_PATH}";`);
});
