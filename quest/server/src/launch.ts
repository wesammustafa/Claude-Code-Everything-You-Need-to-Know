// What the Learner sees at start and stop: the address, the browser opened
// at it outside a codespace, and the line that says how to start again.
import type { spawn as nodeSpawn } from "node:child_process";

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * The forwarded host name in a codespace, from the two variables Codespaces
 * sets in a terminal, or null outside one: the only X-Forwarded-Host the
 * server trusts (src/trust.ts).
 */
export function codespaceHost(env: Env, port: number): string | null {
  const name = env.CODESPACE_NAME;
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!name || !domain) return null;
  return `${name}-${String(port)}.${domain}`;
}

/** The forwarded address in a codespace, or null outside one. */
export function codespaceUrl(env: Env, port: number): string | null {
  const host = codespaceHost(env, port);
  return host && `https://${host}`;
}

/** The local address the server listens on. */
export function localUrl(port: number): string {
  return `http://127.0.0.1:${String(port)}`;
}

/** The platform's own opener and its arguments for a URL. */
export function opener(url: string, platform: string): [string, string[]] {
  if (platform === "darwin") return ["open", [url]];
  // start is a cmd built-in; its first quoted argument is a window title.
  if (platform === "win32") return ["cmd", ["/c", "start", '""', url]];
  return ["xdg-open", [url]];
}

/**
 * Opens the Learner's browser at `url`, detached so the server never waits
 * on it. A missing opener only means no browser opens: the address is
 * printed either way.
 */
export function openBrowser(
  url: string,
  platform: string,
  spawn: typeof nodeSpawn,
): void {
  const [command, args] = opener(url, platform);
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      // Node would quote the empty title as "\"\"", which cmd misreads; the
      // URL holds no space or cmd metacharacter, so nothing needs quoting.
      ...(platform === "win32" ? { windowsVerbatimArguments: true } : {}),
    });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // The address is on the screen; the Learner can open it.
  }
}

/**
 * The stop line: where to run the app again. `work` is the Lesson's Work
 * folder, for the line ticket 243 adds when it is not the copy.
 */
export function stopLine({ copy }: { copy: string; work?: string }): string {
  return `Claude Code Quest stopped. To start it again, run npm run learn in ${copy}.`;
}
