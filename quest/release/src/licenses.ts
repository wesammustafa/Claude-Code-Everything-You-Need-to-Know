// The packages whose code ships in Claude Code Quest's bundles, their licenses
// and the notices file that credits them.
//
// The shipped set is the production dependency tree of each shipping
// workspace, read from the root lockfile: a workspace's `dependencies` (never
// its `devDependencies`), followed through each package's `dependencies` and
// installed `optionalDependencies` with Node's own lookup order, plus the
// bundler whose runtime helpers the bundle carries. Peer dependencies are left
// to the workspace that declares them. The client build
// cross-checks this set against the modules and stylesheets it actually
// bundled (`quest/client/build/shipped-packages.ts`), so nothing ships
// without being counted.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";

/** Licenses a bundled package may carry. OFL-1.1 is for fonts only. */
export const ALLOWED_LICENSES = [
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "OFL-1.1",
] as const;

/** The workspaces whose production dependencies ship in a bundle. The server joins when it exists. */
export const SHIPPING_WORKSPACES = ["quest/client"] as const;

/**
 * Bundlers whose own runtime helpers land in the bundle: Rolldown, under Vite,
 * adds its CommonJS interop helpers (`\0rolldown/runtime.js`) for React.
 */
export const BUNDLER_RUNTIME = ["rolldown"] as const;

export interface ShippedOptions {
  /** The workspaces whose production dependencies ship. */
  workspaces?: readonly string[];
  /** Packages, resolved from the repo root, whose runtime the bundler injects. */
  bundlerRuntime?: readonly string[];
}

/**
 * Where the license test writes the notices, relative to the repo root: build
 * output, never tracked, which the template assembly copies into `learn/`.
 */
export const NOTICES_FILE = "quest/release/dist/THIRD-PARTY-NOTICES.txt";

export interface ShippedPackage {
  name: string;
  version: string;
  /** The package's key in the lockfile, such as `node_modules/react`. */
  path: string;
  /** The SPDX expression from the installed package.json, if any. */
  license: string | undefined;
}

export interface LicenseProblem {
  name: string;
  version: string;
  license: string | undefined;
  reason: string;
}

interface LockEntry {
  name?: string;
  version?: string;
  license?: string;
  link?: boolean;
  resolved?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface Lockfile {
  lockfileVersion?: number;
  packages?: Record<string, LockEntry>;
}

interface PackageJson {
  name?: string;
  version?: string;
  license?: unknown;
  licenses?: unknown;
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readLockfile(root: string): Record<string, LockEntry> {
  const lock = readJson(join(root, "package-lock.json")) as Lockfile;
  if (
    lock.lockfileVersion === undefined ||
    lock.lockfileVersion < 2 ||
    !lock.packages
  ) {
    throw new Error(
      "package-lock.json must be lockfile version 2 or later, with a packages map",
    );
  }
  return lock.packages;
}

// Node's lookup order: <dir>/node_modules/<name>, then each parent directory's,
// skipping directories that are themselves named node_modules.
function lookupKeys(fromKey: string, name: string): string[] {
  const keys: string[] = [];
  let dir = fromKey;
  for (;;) {
    if (posix.basename(dir) !== "node_modules") {
      keys.push(
        dir === "" ? `node_modules/${name}` : `${dir}/node_modules/${name}`,
      );
    }
    if (dir === "") return keys;
    const parent = posix.dirname(dir);
    dir = parent === "." ? "" : parent;
  }
}

function resolveDependency(
  packages: Record<string, LockEntry>,
  fromKey: string,
  name: string,
): string | undefined {
  return lookupKeys(fromKey, name).find((key) => key in packages);
}

// A lockfile key's package name: the part after its last node_modules/.
function nameFromKey(key: string): string {
  const at = key.lastIndexOf("node_modules/");
  return at === -1 ? key : key.slice(at + "node_modules/".length);
}

function licenseFromPackageJson(pkg: PackageJson): string | undefined {
  if (typeof pkg.license === "string") return pkg.license;
  if (
    typeof pkg.license === "object" &&
    pkg.license !== null &&
    "type" in pkg.license
  ) {
    const type = pkg.license.type;
    if (typeof type === "string") return type;
  }
  // The deprecated `licenses` array means any one of them may be chosen.
  if (Array.isArray(pkg.licenses)) {
    const types = pkg.licenses
      .map((entry: unknown) =>
        typeof entry === "object" && entry !== null && "type" in entry
          ? entry.type
          : undefined,
      )
      .filter((type): type is string => typeof type === "string");
    if (types.length > 0)
      return types.length === 1 ? types[0] : `(${types.join(" OR ")})`;
  }
  return undefined;
}

/**
 * Every third-party package that ships with the given workspaces, sorted by
 * name and lockfile path. Workspace packages themselves are first-party and
 * left out, though their production dependencies are followed.
 */
export function shippedPackages(
  root: string,
  options: ShippedOptions = {},
): ShippedPackage[] {
  const { workspaces = SHIPPING_WORKSPACES, bundlerRuntime = BUNDLER_RUNTIME } =
    options;
  const packages = readLockfile(root);
  const seen = new Set<string>();
  const queue: string[] = [];

  const visit = (
    fromKey: string,
    deps: Record<string, string> | undefined,
    optional: boolean,
  ) => {
    for (const name of Object.keys(deps ?? {})) {
      const key = resolveDependency(packages, fromKey, name);
      if (key === undefined) {
        if (optional) continue;
        throw new Error(
          `${fromKey || "the root"} depends on ${name}, which the lockfile does not hold`,
        );
      }
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(key);
      }
    }
  };

  for (const workspace of workspaces) {
    const entry = packages[workspace];
    if (!entry) throw new Error(`The lockfile has no workspace ${workspace}`);
    visit(workspace, entry.dependencies, false);
    visit(workspace, entry.optionalDependencies, true);
  }
  // Only the bundler's runtime helpers ship, not the packages it builds with.
  const runtimeOnly = new Set<string>();
  for (const name of bundlerRuntime) {
    const key = resolveDependency(packages, "", name);
    if (key === undefined)
      throw new Error(`The lockfile does not hold the bundler ${name}`);
    runtimeOnly.add(key);
    if (!seen.has(key)) {
      seen.add(key);
      queue.push(key);
    }
  }

  const shipped: ShippedPackage[] = [];
  for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
    const entry = packages[key];
    if (!entry) continue;
    if (entry.link === true && entry.resolved !== undefined) {
      // A workspace linked into node_modules: first-party code, but its
      // dependencies still ship.
      const target = entry.resolved;
      const linked = packages[target];
      visit(target, linked?.dependencies, false);
      visit(target, linked?.optionalDependencies, true);
      continue;
    }
    if (!runtimeOnly.has(key)) {
      visit(key, entry.dependencies, false);
      visit(key, entry.optionalDependencies, true);
    }
    const installed = join(root, key, "package.json");
    const pkg = existsSync(installed)
      ? (readJson(installed) as PackageJson)
      : undefined;
    shipped.push({
      name: pkg?.name ?? entry.name ?? nameFromKey(key),
      version: pkg?.version ?? entry.version ?? "unknown",
      path: key,
      license: pkg ? licenseFromPackageJson(pkg) : entry.license,
    });
  }

  return shipped.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en") || a.path.localeCompare(b.path, "en"),
  );
}

// A small SPDX expression reader: identifiers joined by AND and OR, with
// parentheses. `WITH` exceptions and anything unknown are not allowed.
type Expr = { id: string } | { op: "AND" | "OR"; left: Expr; right: Expr };

function parseSpdx(text: string): Expr | undefined {
  const tokens = text.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const primary = (): Expr | undefined => {
    const token = tokens[at++];
    if (token === undefined || token === ")") return undefined;
    if (token === "(") {
      const inner = orExpr();
      if (tokens[at++] !== ")") return undefined;
      return inner;
    }
    if (/^(AND|OR|WITH)$/i.test(token)) return undefined;
    if (/^WITH$/i.test(peek() ?? "")) return undefined;
    return { id: token };
  };
  const andExpr = (): Expr | undefined => {
    let left = primary();
    while (left && /^AND$/i.test(peek() ?? "")) {
      at++;
      const right = primary();
      if (!right) return undefined;
      left = { op: "AND", left, right };
    }
    return left;
  };
  const orExpr = (): Expr | undefined => {
    let left = andExpr();
    while (left && /^OR$/i.test(peek() ?? "")) {
      at++;
      const right = andExpr();
      if (!right) return undefined;
      left = { op: "OR", left, right };
    }
    return left;
  };
  const expr = orExpr();
  return at === tokens.length ? expr : undefined;
}

function satisfied(expr: Expr): boolean {
  if ("id" in expr)
    return (ALLOWED_LICENSES as readonly string[]).includes(expr.id);
  return expr.op === "AND"
    ? satisfied(expr.left) && satisfied(expr.right)
    : satisfied(expr.left) || satisfied(expr.right);
}

/** Whether an SPDX license expression can be met with allowed licenses only. */
export function licenseAllowed(license: string | undefined): boolean {
  if (license === undefined || license.trim() === "") return false;
  const expr = parseSpdx(license);
  return expr !== undefined && satisfied(expr);
}

// A package's own license files, and the files that carry the notices of the
// code it copied in (Rolldown's THIRD-PARTY-LICENSE holds the Rollup and
// esbuild notices for the runtime helpers it injects): each one must travel
// with the bundle.
const LICENSE_FILE =
  /^(third[-_.]?party[-_.]?)?(licen[cs]es?|copying|notices?)(\.(md|txt|markdown))?$|^(licen[cs]e|copying)[-_.]/i;

function licenseFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));
}

/** Every shipped package whose license is outside the allowlist or has no license text. */
export function licenseProblems(
  root: string,
  shipped: readonly ShippedPackage[],
): LicenseProblem[] {
  const problems: LicenseProblem[] = [];
  for (const pkg of shipped) {
    const base = { name: pkg.name, version: pkg.version, license: pkg.license };
    if (!licenseAllowed(pkg.license)) {
      problems.push({
        ...base,
        reason: `license ${pkg.license ?? "(none)"} is not on the allowlist`,
      });
    } else if (licenseFiles(join(root, pkg.path)).length === 0) {
      problems.push({
        ...base,
        reason: "no license file to credit in the notices",
      });
    }
  }
  return problems;
}

/** The notices text: every shipped package with its license and license files, in a stable order. */
export function renderNotices(
  root: string,
  shipped: readonly ShippedPackage[],
): string {
  const parts = [
    "Claude Code Quest: third-party notices",
    "",
    "Claude Code Quest bundles the packages below. Each is listed with its version,",
    "its license and the license text it ships with.",
  ];
  for (const pkg of shipped) {
    parts.push(
      "",
      "=".repeat(78),
      `${pkg.name} ${pkg.version}`,
      `License: ${pkg.license ?? "(none)"}`,
      "",
    );
    for (const file of licenseFiles(join(root, pkg.path))) {
      const text = readFileSync(join(root, pkg.path, file), "utf8")
        .replace(/\r\n?/g, "\n")
        .trimEnd();
      parts.push(`--- ${file} ---`, text, "");
    }
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

/** Fails on any license problem; otherwise writes the notices file and returns the shipped set. */
export function writeNotices(
  root: string,
  outFile: string,
  options: ShippedOptions = {},
): ShippedPackage[] {
  const shipped = shippedPackages(root, options);
  const problems = licenseProblems(root, shipped);
  if (problems.length > 0) {
    const lines = problems.map((p) => `- ${p.name} ${p.version}: ${p.reason}`);
    throw new Error(
      `Bundled packages outside the license allowlist:\n${lines.join("\n")}`,
    );
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, renderNotices(root, shipped));
  return shipped;
}
