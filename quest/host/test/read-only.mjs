// The read-only guard (spec, Never runs Claude Code for the Learner),
// widened from learn-io's to the engine and the host (ticket 209): no
// network, no process but the Check child and read-only git, no signal but
// to a Check child's group, and no file write outside the store. Pure: it
// reads source text it is handed, comments included, so a planted call is
// found wherever it sits. Each finding is a string naming the file and what
// it does.
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

// Modules that open a connection, or a thread or process that could.
const NET_MODULES =
  "http|https|http2|net|tls|dgram|dns|worker_threads|cluster|undici|ws";
const NET_SPECIFIER = new RegExp(
  `(?:\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\bimport\\s*|\\brequire\\s*\\(\\s*)["'](?:node:)?(?:${NET_MODULES})(?:/[^"']*)?["']`,
);
// A member call counts too: `globalThis.fetch(`.
const NET_CALLS = [
  /(?<![\w$])fetch\s*\(/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bXMLHttpRequest\b/,
  /new\s+Worker\s*\(/,
];

// Every way to start a process but execFile and the Check child's spawn, as
// a member call too: a module object's name need not be written out. Only a
// RegExp's `.exec(` passes. It reads the text with the allowed calls blanked.
const OTHER_PROCESS =
  /(?<![\w$])(spawn|spawnSync|execSync|execFileSync|fork)\s*\(|(?<![.\w$])(exec)\s*\(|\.\s*(execFile)\s*\(/;
// Ways to load a module the specifier patterns can't read: a computed
// import() or require(), a require made by hand, or a built-in by name.
const LOADERS =
  /\b(?:import|require)\s*\(\s*(?!(["'])[^"'`]*\1\s*[,)])|\b(createRequire|getBuiltinModule|process\s*\.\s*(?:binding|dlopen))\b/;
// child_process comes in one way only: execFile, spawn or both by name,
// unaliased.
const CHILD_PROCESS = /child_process/g;
const CHILD_IMPORT =
  /import\s*\{\s*(execFile|spawn|execFile\s*,\s*spawn)\s*,?\s*\}\s*from\s*["']node:child_process["']/g;
// execFile and spawn by name, anywhere but a property: a call, or a value
// handed on.
const EXEC_FILE = /(?<![.\w$])execFile\b/g;
const SPAWN = /(?<![.\w$])spawn\b/g;
// The calls they may make: the Check child, with its entry first, and git's
// read-only commands; spawn only the Check child.
const ALLOWED_CALLS = [
  /(?<![.\w$])execFile\s*\(\s*process\.execPath\s*,\s*\[\s*RUN_CHECK\b/g,
  /(?<![.\w$])execFile\s*\(\s*["']git["']\s*,\s*\[\s*["'](?:status|rev-parse|check-ignore)["']/g,
  /(?<![.\w$])execFile\s*\(\s*["']git["']\s*,\s*\[\s*["']config["']\s*,\s*["']user\.name["']\s*,?\s*\]/g,
];
const ALLOWED_SPAWN =
  /(?<![.\w$])spawn\s*\(\s*process\.execPath\s*,\s*\[\s*RUN_CHECK\b/g;
// A file that runs RUN_CHECK names it once, as run-check.mjs beside itself,
// and gives the name no other value.
const RUN_CHECK_IN = /\[\s*RUN_CHECK\b/g;
const RUN_CHECK_DEF =
  /\bconst\s+RUN_CHECK\s*=\s*join\(\s*dirname\(\s*fileURLToPath\(\s*import\.meta\.url\s*\)\s*\)\s*,\s*["']run-check\.mjs["']\s*,?\s*\)/g;
const RUN_CHECK_BOUND = /\bRUN_CHECK\s*=(?!=)|\bas\s+RUN_CHECK\b/g;
// A signal goes only to the Check child's own process group, which its
// spawn makes: `process.kill(-child.pid, ...)`, in check-child.mjs alone.
// `process` is read by its members only, so no kill hides behind a name, a
// computed member or an argument.
const KILL = /\bprocess\s*(?:\?\.|\.)\s*kill\b/g;
const GROUP_KILL = /\bprocess\.kill\(\s*-\s*child\.pid\s*,/g;
const KILLS_HERE = "quest/host/src/check-child.mjs";
const PROCESS_HANDED =
  /(?<![=!<>])=\s*process\b(?!\s*(?:\?\.|\.))|\bprocess\s*(?:\?\.\s*)?\[|[(,]\s*process\s*[,)]/;

// What the fs modules may give outside the store: reads, by name, unaliased.
const FS_READS = new Set([
  "existsSync",
  "readFileSync",
  "readdirSync",
  "statSync",
  "lstatSync",
  "accessSync",
  "realpathSync",
  "constants",
  "watch",
  "readFile",
  "readdir",
  "stat",
  "lstat",
  "access",
  "realpath",
]);
const FS_SPECIFIER = /["'](?:node:)?fs(?:\/promises)?["']/g;
const FS_IMPORT =
  /\bimport\s+((?:(?!\bfrom\b)[^;])*?)\s*from\s*["'](?:node:)?fs(?:\/promises)?["']/g;
// A read name opened to write: `readFileSync(p, { flag: "w" })`.
const OPEN_FLAG = /\bflags?\s*:/;
const WRITES =
  /\b(writeFile|appendFile|rename|rm|rmdir|unlink|mkdir|copyFile|cp|createWriteStream|truncate|symlink|link|chmod|utimes|writeSync|writev)(Sync)?\s*\(/;

// What Node 22, the oldest the template supports, lacks.
const NEWER_NODE = /\bimport\.meta\.main\b|\bstyleText\b/;

const count = (re, text) => [...text.matchAll(re)].length;

// The findings for `files` ([{ path, text }], paths from the repository's
// root, with forward slashes). `store` is the one file that may write.
export function readOnlyFindings(
  files,
  { store = "quest/host/src/store.mjs" } = {},
) {
  const found = [];
  for (const { path, text } of files) {
    const say = (what) => found.push(`${path}: ${what}`);
    if (NET_SPECIFIER.test(text)) say("imports a network module");
    for (const re of NET_CALLS)
      if (re.test(text)) say(`uses the network (${re.source})`);

    const blanked = [...ALLOWED_CALLS, ALLOWED_SPAWN].reduce(
      (t, re) => t.replace(re, ""),
      text,
    );
    const other = OTHER_PROCESS.exec(blanked);
    if (other) say(`starts a process with ${other[1] ?? other[2] ?? other[3]}`);
    if (LOADERS.test(text)) say("loads a module by a name it computes");
    const imports = [...text.matchAll(CHILD_IMPORT)].map((m) => m[1]);
    if (count(CHILD_PROCESS, text) !== imports.length)
      say("reaches child_process another way than a named import");
    const named = (name) => imports.filter((i) => i.includes(name)).length;
    const allowed = ALLOWED_CALLS.reduce((n, re) => n + count(re, text), 0);
    if (count(EXEC_FILE, text) !== named("execFile") + allowed)
      say("runs execFile with another program or command");
    if (count(SPAWN, text) !== named("spawn") + count(ALLOWED_SPAWN, text))
      say("runs spawn with another program");
    if (
      count(RUN_CHECK_IN, text) &&
      (count(RUN_CHECK_DEF, text) !== 1 || count(RUN_CHECK_BOUND, text) !== 1)
    )
      say("runs a RUN_CHECK that is not run-check.mjs");
    if (
      count(KILL, text) !== (path === KILLS_HERE ? count(GROUP_KILL, text) : 0)
    )
      say("signals a process that is not a child's group");
    if (PROCESS_HANDED.test(text))
      say("hands process on, where what it calls can't be read");

    if (path !== store) {
      const clauses = [...text.matchAll(FS_IMPORT)].map((m) => m[1].trim());
      if (count(FS_SPECIFIER, text) !== clauses.length)
        say("reaches fs another way than an import");
      for (const clause of clauses) {
        const names = /^\{([^}]*)\}$/.exec(clause);
        if (!names) {
          say(`imports fs whole (${clause})`);
          continue;
        }
        for (const name of names[1].split(",").map((n) => n.trim()))
          if (name && !FS_READS.has(name)) say(`imports ${name} from fs`);
      }
      const write = WRITES.exec(text);
      if (write) say(`writes a file with ${write[0].replace(/\s*\($/, "")}`);
      if (OPEN_FLAG.test(text)) say("opens a file with a flag");
    }

    if (path.startsWith("quest/host/src/") && NEWER_NODE.test(text))
      say("needs a newer Node than 22");
  }
  return found;
}

// Every relative module a file reaches: through an import, a re-export, a
// bare import or a dynamic import(), on one line or wrapped as Prettier
// wraps them (quest/engine/test/engine.test.mjs's walk).
const RELATIVE =
  /^(?:import|export)\s[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|^import\s+['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]/gms;
export const relativeOf = (text) =>
  [...text.matchAll(RELATIVE)].map((m) => m[1] ?? m[2] ?? m[3]);

// The absolute paths `from` reaches, itself included. The walk does not go
// into `stop` (absolute folder paths): what is there is not followed, nor
// listed.
export function reached(from, { stop = [] } = {}, out = new Set()) {
  if (out.has(from) || stop.some((s) => from.startsWith(s))) return out;
  out.add(from);
  for (const to of relativeOf(readFileSync(from, "utf8")))
    reached(resolve(dirname(from), to), { stop }, out);
  return out;
}

// `files` as the guard reads them: paths from `root`, with forward slashes.
export const asSources = (root, files) =>
  [...files].map((file) => ({
    path: relative(root, file).split("\\").join("/"),
    text: readFileSync(file, "utf8"),
  }));
