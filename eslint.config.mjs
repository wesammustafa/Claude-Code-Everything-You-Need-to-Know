// Lints Claude Code Quest's source under quest/ and nothing else: the Guide,
// the examples and the maintainer scripts are never linted or fixed by ESLint.
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["*", "!quest/", "quest/*/dist/"]),
  {
    files: ["quest/**/*.{ts,tsx,mts,cts}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // The browser imports the contract's types and never any engine, host or
  // server code (ticket 212's boundary test holds the compiled side).
  {
    files: ["quest/client/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@quest/contract",
              message: "The contract is types only: import type.",
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: ["@quest/engine*", "@quest/host*", "@quest/server*"],
              message: "The browser never imports engine, host or server code.",
            },
          ],
        },
      ],
    },
  },
  // The engine is pure: it runs inside the host and never reaches back into
  // the host, the server or the browser (ticket 214).
  {
    files: ["quest/engine/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@quest/host*", "@quest/server*", "@quest/client*"],
              message:
                "The engine is pure: it never imports the host, the server or the client.",
            },
          ],
        },
      ],
    },
  },
  // The host runs the engine and never reaches up into the server or the
  // browser (ticket 215).
  {
    files: ["quest/host/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@quest/server*", "@quest/client*"],
              message:
                "The host never imports the server or the client.",
            },
          ],
        },
      ],
    },
  },
]);
