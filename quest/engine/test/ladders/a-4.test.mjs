import { ladderTest } from "./ladder.mjs";

// Its scenarios make symlinks and set file modes.
ladderTest("a-4", { posix: true });
