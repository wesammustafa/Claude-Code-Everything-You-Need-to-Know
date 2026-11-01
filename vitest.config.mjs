import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// One Vitest project per quest/ package. Only folders count: a glob such as
// quest/* would also match quest/AGENTS.md and quest/CLAUDE.md, which Vitest
// rejects as project configs.
const quest = fileURLToPath(new URL("quest/", import.meta.url));
const packages = readdirSync(quest, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => quest + entry.name);

export default defineConfig({
  test: {
    projects: packages,
    passWithNoTests: true,
  },
});
