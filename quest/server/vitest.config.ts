import { defineConfig } from "vitest/config";

// The server's tests, kept apart from vite.config.ts, which is the bundle's
// build.
export default defineConfig({
  test: {
    name: "server",
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
