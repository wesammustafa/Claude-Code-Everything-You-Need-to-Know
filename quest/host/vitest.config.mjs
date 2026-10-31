import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "host",
    environment: "node",
    include: ["test/**/*.test.mjs"],
  },
});
