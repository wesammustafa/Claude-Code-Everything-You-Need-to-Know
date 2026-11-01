// The headers every response carries (spec, Server security), the same bytes
// the client's preview sends (quest/client/build/plugins.ts PREVIEW_HEADERS),
// so an e2e run meets this policy. A test holds the two equal.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze(
  {
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  },
);

/** Every API response's Cache-Control. */
export const API_CACHE = "no-store";
