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

/**
 * Licenses bundled code may carry: a package's own, and that of the code it
 * compiled or copied into its files. OFL-1.1 is for fonts only. The owner added
 * MIT-Modern-Variant and MIT-0 for the code compiled into Rive's WASM
 * (HarfBuzz, and miniaudio under Unlicense OR MIT-0).
 */
export const ALLOWED_LICENSES = [
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "OFL-1.1",
  "MIT-Modern-Variant",
  "MIT-0",
  // 0BSD (tslib, via motion; OSI-approved, more permissive than MIT; added 2026-10-30 for owner review)
  "0BSD",
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

/** A license text kept in this repo for a package published without one. */
export interface SuppliedLicense {
  /** The text, relative to the repo root. */
  file: string;
  /** Where it was copied from: the source repository's file at the release's commit. */
  source: string;
}

/**
 * License texts for shipped packages published without one, each copied from
 * the package's source repository at the commit its release was tagged from.
 * A package matches by name and exact version, so a version bump fails the
 * license test until the new release's text is checked and supplied.
 */
export const SUPPLIED_LICENSES: Readonly<Record<string, SuppliedLicense>> = {
  "@rive-app/react-webgl2@4.37.1": {
    file: "quest/release/licenses/rive-react-v4.37.1-LICENSE",
    source:
      "https://github.com/rive-app/rive-react/blob/8f4ab5a831bb92e96e3076af5ecbd6963112d1ac/LICENSE",
  },
  "@rive-app/webgl2@2.45.1": {
    file: "quest/release/licenses/rive-wasm-2.45.1-LICENSE",
    source:
      "https://github.com/rive-app/rive-wasm/blob/dc6c23329b5395591aad6fb9cc29c30fa75e87cc/LICENSE",
  },
};

/** Third-party code a package compiled or copied into the files it ships, with that code's notice. */
export interface EmbeddedNotice {
  /** The project the code comes from, as the notices name it. */
  project: string;
  /** The project's license, as an SPDX expression. */
  license: string;
  /** The notice text, relative to the repo root. */
  file: string;
  /** Where it was copied from: the project's file at the revision the package's build used. */
  source: string;
}

/** The embedded notices of one package, gathered for one exact version. */
export interface EmbeddedNotices {
  version: string;
  notices: readonly EmbeddedNotice[];
}

const RIVE_EMBEDDED = "quest/release/licenses/rive-webgl2-2.45.1-embedded";

/**
 * Notices for code a shipped package carries inside its own files, which its
 * own license text does not cover: the libraries compiled into a WASM binary,
 * or code copied into its JavaScript. They are gathered from the package's
 * build at its release, for one exact version, so a version bump fails the
 * license test until they are gathered again.
 *
 * @rive-app/webgl2 2.45.1 is built from rive-wasm dc6c233 (its LICENSE is
 * supplied above) with rive-runtime c51c078 and emsdk 4.0.23, for the webgl2
 * renderer with text, audio, layout and scripting, and without the image
 * decoders. rive.wasm compiles in the Skia code rive-wasm and the renderer
 * import, HarfBuzz (with Microsoft's USE table data) and SheenBidi for text,
 * miniaudio, Yoga, the Luau VM, libhydrogen, and Emscripten's runtime and musl
 * libc; rive.js carries Emscripten's glue and a copy of braintree/sanitize-url.
 * (libc++ and compiler-rt are under the LLVM exception, which asks no notice
 * for compiled code.)
 */
export const EMBEDDED_NOTICES: Readonly<Record<string, EmbeddedNotices>> = {
  "@rive-app/webgl2": {
    version: "2.45.1",
    notices: [
      {
        project: "Rive runtime and renderer",
        license: "MIT",
        file: `${RIVE_EMBEDDED}/rive-runtime-LICENSE`,
        source:
          "https://github.com/rive-app/rive-runtime/blob/c51c078efba52f369cccbbbfd26c99bc2421d613/LICENSE",
      },
      {
        project: "Skia",
        license: "BSD-3-Clause",
        file: `${RIVE_EMBEDDED}/skia-LICENSE`,
        source:
          "https://github.com/google/skia/blob/b4171f5ba83048039097bbc664eaa076190f6239/LICENSE",
      },
      {
        project: "HarfBuzz",
        license: "MIT-Modern-Variant",
        file: `${RIVE_EMBEDDED}/harfbuzz-COPYING`,
        source:
          "https://github.com/rive-app/harfbuzz/blob/08d34675f64b1ac4880f4f10c9fd474a56dd4399/COPYING",
      },
      {
        project: "HarfBuzz: Microsoft's Universal Shaping Engine data",
        license: "MIT",
        file: `${RIVE_EMBEDDED}/harfbuzz-ms-use-COPYING`,
        source:
          "https://github.com/rive-app/harfbuzz/blob/08d34675f64b1ac4880f4f10c9fd474a56dd4399/src/ms-use/COPYING",
      },
      {
        project: "SheenBidi",
        license: "Apache-2.0",
        file: `${RIVE_EMBEDDED}/sheenbidi-LICENSE`,
        source:
          "https://github.com/Tehreer/SheenBidi/blob/adfccc46504b1be37b8894f064121c56c31312f7/LICENSE",
      },
      {
        project: "Yoga",
        license: "MIT",
        file: `${RIVE_EMBEDDED}/yoga-LICENSE`,
        source:
          "https://github.com/rive-app/yoga/blob/9a6ac7fac43ca22d9b1e56468e5c8200ba0a07d3/LICENSE",
      },
      {
        project: "Luau",
        license: "MIT",
        file: `${RIVE_EMBEDDED}/luau-LICENSE.txt`,
        source:
          "https://github.com/luigi-rosso/luau/blob/c1c57894ff8f4fdacf171179eddd04c27cc5f7da/LICENSE.txt",
      },
      {
        project: "Lua, in Luau",
        license: "MIT",
        file: `${RIVE_EMBEDDED}/lua-LICENSE.txt`,
        source:
          "https://github.com/luigi-rosso/luau/blob/c1c57894ff8f4fdacf171179eddd04c27cc5f7da/lua_LICENSE.txt",
      },
      {
        project: "libhydrogen",
        license: "ISC",
        file: `${RIVE_EMBEDDED}/libhydrogen-LICENSE`,
        source:
          "https://github.com/luigi-rosso/libhydrogen/blob/4c298c5e3012d891b8b375c6dd215f580a36ed60/LICENSE",
      },
      {
        project: "miniaudio",
        license: "Unlicense OR MIT-0",
        file: `${RIVE_EMBEDDED}/miniaudio-LICENSE`,
        source:
          "https://github.com/rive-app/miniaudio/blob/3a8b070f80e203a35ec763c5118da20805a90d5a/LICENSE",
      },
      {
        project: "Emscripten",
        license: "MIT OR NCSA",
        file: `${RIVE_EMBEDDED}/emscripten-LICENSE`,
        source:
          "https://github.com/emscripten-core/emscripten/blob/7a5d93b50f6a3a35e85a0d2fc9e667b8498e6aed/LICENSE",
      },
      {
        project: "musl libc, in Emscripten",
        license: "MIT",
        file: `${RIVE_EMBEDDED}/musl-COPYRIGHT`,
        source:
          "https://github.com/emscripten-core/emscripten/blob/7a5d93b50f6a3a35e85a0d2fc9e667b8498e6aed/system/lib/libc/musl/COPYRIGHT",
      },
      {
        project: "sanitize-url",
        license: "MIT",
        file: `${RIVE_EMBEDDED}/sanitize-url-LICENSE`,
        source:
          "https://github.com/braintree/sanitize-url/blob/ff8da9bb5fc68761658046365a842c8202dd2d3c/LICENSE",
      },
    ],
  },
};

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
// esbuild notices for the runtime helpers it injects; tslib's
// CopyrightNotice.txt is the banner its helpers carry): each one must travel
// with the bundle.
const LICENSE_FILE =
  /^(third[-_.]?party[-_.]?|copyright[-_.]?)?(licen[cs]es?|copying|notices?)(\.(md|txt|markdown))?$|^(licen[cs]e|copying)[-_.]/i;

function licenseFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));
}

type Supplied = Readonly<Record<string, SuppliedLicense>>;
type Embedded = Readonly<Record<string, EmbeddedNotices>>;

/** The license text supplied for a package, matched by name and exact version. */
function suppliedFor(
  pkg: ShippedPackage,
  supplied: Supplied,
): SuppliedLicense | undefined {
  return supplied[`${pkg.name}@${pkg.version}`];
}

/**
 * Every shipped package whose license is outside the allowlist or has no
 * license text: neither a file of its own nor one supplied for its exact
 * version, or whose embedded code is under a license outside the allowlist.
 * A package that ships its own text while one is also supplied is a problem
 * too, so a supplied text never outlives its need.
 */
export function licenseProblems(
  root: string,
  shipped: readonly ShippedPackage[],
  supplied: Supplied = SUPPLIED_LICENSES,
  embedded: Embedded = EMBEDDED_NOTICES,
): LicenseProblem[] {
  const problems: LicenseProblem[] = [];
  for (const pkg of shipped) {
    const base = { name: pkg.name, version: pkg.version, license: pkg.license };
    const inside = embedded[pkg.name];
    if (inside && inside.version !== pkg.version) {
      problems.push({
        ...base,
        reason: `the notices for the code compiled or copied into it were gathered for ${inside.version}; gather them again for ${pkg.version}`,
      });
    } else if (inside) {
      for (const notice of inside.notices) {
        if (!existsSync(join(root, notice.file)))
          problems.push({
            ...base,
            reason: `the ${notice.project} notice ${notice.file} is missing`,
          });
        if (!licenseAllowed(notice.license))
          problems.push({
            ...base,
            reason: `the ${notice.project} code compiled or copied into it is under ${notice.license}, which is not on the allowlist`,
          });
      }
    }
    const own = licenseFiles(join(root, pkg.path));
    const text = suppliedFor(pkg, supplied);
    if (!licenseAllowed(pkg.license)) {
      problems.push({
        ...base,
        reason: `license ${pkg.license ?? "(none)"} is not on the allowlist`,
      });
    } else if (own.length > 0 && text) {
      problems.push({
        ...base,
        reason: `ships its own license file, so its supplied text ${text.file} is no longer needed`,
      });
    } else if (own.length === 0 && !text) {
      problems.push({
        ...base,
        reason: "no license file to credit in the notices",
      });
    } else if (text && !existsSync(join(root, text.file))) {
      problems.push({
        ...base,
        reason: `its supplied license text ${text.file} is missing`,
      });
    }
  }
  return problems;
}

/** The notices text: every shipped package with its license and license files, in a stable order. */
export function renderNotices(
  root: string,
  shipped: readonly ShippedPackage[],
  supplied: Supplied = SUPPLIED_LICENSES,
  embedded: Embedded = EMBEDDED_NOTICES,
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
    const text = suppliedFor(pkg, supplied);
    if (text && licenseFiles(join(root, pkg.path)).length === 0) {
      const body = readFileSync(join(root, text.file), "utf8")
        .replace(/\r\n?/g, "\n")
        .trimEnd();
      parts.push(`--- LICENSE (from ${text.source}) ---`, body, "");
    }
    const inside = embedded[pkg.name];
    if (inside?.version === pkg.version) {
      parts.push(
        "It carries code from the projects below, compiled or copied into its files.",
        "",
      );
      for (const notice of inside.notices) {
        const body = readFileSync(join(root, notice.file), "utf8")
          .replace(/\r\n?/g, "\n")
          .trimEnd();
        parts.push(
          `--- ${notice.project}, ${notice.license} (from ${notice.source}) ---`,
          body,
          "",
        );
      }
    }
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

/** Fails on any license problem; otherwise writes the notices file and returns the shipped set. */
export function writeNotices(
  root: string,
  outFile: string,
  options: ShippedOptions & { supplied?: Supplied; embedded?: Embedded } = {},
): ShippedPackage[] {
  const {
    supplied = SUPPLIED_LICENSES,
    embedded = EMBEDDED_NOTICES,
    ...shippedOptions
  } = options;
  const shipped = shippedPackages(root, shippedOptions);
  const problems = licenseProblems(root, shipped, supplied, embedded);
  if (problems.length > 0) {
    const lines = problems.map((p) => `- ${p.name} ${p.version}: ${p.reason}`);
    throw new Error(
      `Bundled packages outside the license allowlist:\n${lines.join("\n")}`,
    );
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, renderNotices(root, shipped, supplied, embedded));
  return shipped;
}
