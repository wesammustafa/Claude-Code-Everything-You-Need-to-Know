// @ts-check
// Team marketplace helpers shared by Advanced lesson 6's check and the
// Advanced capstone: the marketplaces a repository commits, read as Claude
// Code reads `.claude-plugin/marketplace.json`; the plugins their entries list
// by a relative path, with the components each holds; and the committed
// settings that register a marketplace and turn its plugins on. They read
// git and the working tree only, never Claude Code.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
/** @import { Repo } from './repo.mjs' */

// The Advanced checks never scan worktrees, dependencies, or the template's
// own checks and capstone briefs.
const SKIPPED = /^(?:checks|capstone)\/|(?:^|\/)(?:node_modules|\.claude\/worktrees)\//;
const MARKETPLACE = /(?:^|\/)\.claude-plugin\/marketplace\.json$/;
// The folder this guide's example keeps its marketplace file in, so that the
// guide's own repository can't act as a marketplace.
const RENAMED = /(?:^|\/)dot-claude-plugin\/marketplace\.json$/;
const PLUGIN = /(?:^|\/)\.claude-plugin\/plugin\.json$/;
// Marketplace and plugin names: letters, digits, `.`, `_` and `-`, starting
// with a letter or digit.
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SETTINGS = '.claude/settings.json';

// The names a marketplace can't take, from the marketplace reference's
// Reserved names, compared in any casing: the official, community and plugin
// directory names, the names Claude Code uses for plugins that don't come
// from a marketplace, and the package manager names.
const RESERVED = new Set([
  'claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official', 'anthropic-marketplace', 'anthropic-plugins',
  'agent-skills', 'anthropic-agent-skills', 'life-sciences', 'knowledge-work-plugins', 'claude-for-legal',
  'claude-for-financial-services', 'financial-services-plugins', 'first-party-plugins', 'claude-tag-plugins',
  'claude-community', 'claude-plugins-community', 'healthcare',
  'anthropic-plugin-directory', 'claude-plugin-directory',
  'inline', 'builtin', 'skills-dir', 'synced', 'claude-plugin-test',
  'npm', 'pip', 'uv', 'cargo', 'github', 'gh',
]);

const code = (/** @type {unknown} */ text) => `\`${text}\``;
const shell = (/** @type {string} */ path) => (/\s/.test(path) ? `"${path}"` : path);
/**
 * A JSON object, of any shape: the files read here are the Learner's.
 * @typedef {Record<string, any>} Json
 */

/** @type {(value: unknown) => value is Json} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const own = (/** @type {unknown} */ object, /** @type {string} */ key) => isObject(object) && Object.prototype.hasOwnProperty.call(object, key);

const paths = (/** @type {() => string} */ run) => {
  try {
    return run().split('\0').filter(Boolean);
  } catch {
    return [];
  }
};

// A committed JSON file, read as `{ value }` or `{ error }`. Claude Code's
// `claude plugin validate` at v2.1.285 reads a marketplace.json or plugin.json
// that starts with a UTF-8 byte-order mark, so `bom: true` skips one; it
// rejects one in hooks/hooks.json, so elsewhere the error names the mark.
/**
 * @param {string} text
 * @param {{ bom?: boolean }} [options]
 * @returns {{ value: any, error?: undefined } | { error: string, value?: undefined }}
 */
export function parseJson(text, { bom = false } = {}) {
  let body = text;
  if (body.startsWith('\uFEFF')) {
    if (!bom) return { error: 'it starts with a UTF-8 byte-order mark. Save it as UTF-8 without one, and commit.' };
    body = body.slice(1);
  }
  try {
    return { value: JSON.parse(body) };
  } catch (error) {
    return { error: /** @type {Error} */ (error).message };
  }
}
const manifestJson = (/** @type {string} */ text) => parseJson(text, { bom: true });

/**
 * @param {Repo} repo
 * @param {string} path
 */
export function headText(repo, path) {
  try {
    return repo.git('show', `HEAD:./${path}`);
  } catch {
    return null;
  }
}

// Every file committed at HEAD outside the folders the checks skip, read
// once per repository.
/** @type {WeakMap<Repo, string[]>} */
const listed = new WeakMap();
/**
 * @param {Repo} repo
 * @returns {string[]}
 */
export function committedFiles(repo) {
  if (!listed.has(repo)) listed.set(repo, paths(() => repo.git('ls-tree', '-r', '-z', '--name-only', 'HEAD')).filter((p) => !SKIPPED.test(p)));
  return /** @type {string[]} */ (listed.get(repo));
}

// The ignore rule that hides `path`, as git reports it with the Learner's own
// configuration, global excludes file included, or null.
/**
 * @param {Repo} repo
 * @param {string} path
 */
function ignoreRule(repo, path) {
  try {
    const out = execFileSync('git', ['check-ignore', '--stdin', '-z', '-v', '--no-index'], { cwd: repo.dir, input: `${path}\0`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const [source, line, pattern] = out.split('\0');
    return source ? { source, line: Number(line), pattern } : null;
  } catch {
    return null;
  }
}

// How to commit `what`, a file or folder git doesn't track yet, naming the
// rule that hides `path`, a file in it, if one does.
/**
 * @param {Repo} repo
 * @param {string} path
 */
export function commitHint(repo, path, what = path) {
  const rule = ignoreRule(repo, path);
  if (!rule) return `${code(what)} isn't committed. Run \`git add ${shell(what)}\` and commit it.`;
  return `${code(what)} isn't committed, and line ${rule.line} of ${code(rule.source)}, ${code(rule.pattern)}, ignores it. Run \`git add -f ${shell(what)}\` and commit it.`;
}

// The paths matching `pattern`, a glob under any folder, that are in the
// working tree or the index but not committed at HEAD, ignored ones too.
/**
 * @param {Repo} repo
 * @param {string} pattern
 */
export function uncommittedFiles(repo, pattern) {
  const spec = `:(glob)**/${pattern}`;
  const ignored = paths(() => repo.git('ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', spec));
  const loose = paths(() => repo.git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', spec));
  const committed = new Set(committedFiles(repo));
  return [...new Set([...loose, ...ignored])].filter((p) => !SKIPPED.test(p) && !committed.has(p)).sort();
}

// What is wrong with a marketplace name, as a clause, or null.
/** @param {unknown} name */
export function nameProblem(name) {
  if (typeof name !== 'string' || !name.trim()) return 'has no `name`';
  if (!NAME.test(name) || name.includes('..')) return `names the marketplace ${code(name)}, but a marketplace name takes only letters, digits, \`.\`, \`_\` and \`-\`, starts with a letter or digit, and has no \`..\``;
  const lower = name.toLowerCase();
  if (lower.startsWith('claudeai-')) return `names the marketplace ${code(name)}, but names starting with \`claudeai-\` are reserved for marketplaces hosted on claude.ai`;
  // Another spelling of a reserved name: a trailing dot, or a dot for a hyphen.
  const spelled = lower.replace(/\.$/, '').replace(/\./g, '-');
  const reserved = RESERVED.has(lower) ? lower : RESERVED.has(spelled) ? spelled : null;
  if (reserved) return `names the marketplace ${code(name)}, which Claude Code reserves${reserved === lower ? '' : ` as another spelling of ${code(reserved)}`}`;
  return null;
}

// A folder path relative to the repository, without `./` or a trailing
// slash; the root is ''.
const folder = (/** @type {string} */ path) => {
  const p = posix.normalize(path).replace(/\/+$/, '');
  return p === '.' ? '' : p.replace(/^\.\//, '');
};
const inside = (/** @type {string} */ dir, /** @type {string} */ rest) => (dir ? `${dir}/${rest}` : rest);
// How a settings file writes a folder: `./team-marketplace`, or `.` for the root.
export const relativePath = (/** @type {string} */ dir) => (dir ? `./${dir}` : '.');

// The components a plugin at `dir` commits: skills in skills/<name>/SKILL.md,
// subagents in agents/, in subfolders too, and hooks in hooks/hooks.json.
// Each is `{ path, rel }`, `rel` being the path inside the plugin.
/** @typedef {{ path: string, rel: string }} Component */
/** @typedef {{ skills: Component[], agents: Component[], hooks: Component[] }} Components */

/**
 * @param {string[]} files
 * @param {string} dir
 * @returns {Components}
 */
export function pluginComponents(files, dir) {
  const prefix = dir ? `${dir}/` : '';
  const within = files.filter((p) => p.startsWith(prefix)).map((path) => ({ path, rel: path.slice(prefix.length) }));
  return {
    skills: within.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f.rel)),
    agents: within.filter((f) => /^agents\/.+\.md$/.test(f.rel)),
    hooks: within.filter((f) => f.rel === 'hooks/hooks.json'),
  };
}

const componentCount = (/** @type {Components} */ c) => c.skills.length + c.agents.length + c.hooks.length;

// How far one entry of a marketplace gets: 0, no usable name; 1, not listed
// by a relative path; 2, no committed plugin there; 3, its plugin.json has no
// name; 4, the names differ; 5, no components; 6, passes. Returns
// `{ stage, hint }`, plus `name`, `dir` and `manifest` once a plugin is found.
/**
 * @typedef {{ stage: number, hint?: string, name?: string, dir?: string, manifest?: string, ok?: true, components?: Components }} Entry
 */

/**
 * @typedef {{ path: string, root: string, entries: Entry[], plugins: Entry[], stage: number, hint?: string | undefined, name?: any, entry?: number }} Marketplace
 */

/**
 * @param {Repo} repo
 * @param {{ path: string, root: string }} marketplace
 * @param {unknown} entry
 * @param {number} index
 * @param {Set<string>} committed
 * @returns {Entry}
 */
function reviewEntry(repo, marketplace, entry, index, committed) {
  const label = isObject(entry) && typeof entry.name === 'string' && entry.name ? code(entry.name) : `number ${index + 1}`;
  const where = `The entry ${label} in ${code(marketplace.path)}`;
  if (!isObject(entry)) return { stage: 0, hint: `${where} isn't an object with a \`name\` and a \`source\`.` };
  if (typeof entry.name !== 'string' || !NAME.test(entry.name)) return { stage: 0, hint: `${where} needs a \`name\` made of letters, digits, \`.\`, \`_\` and \`-\`, starting with a letter or digit.` };
  const { name, source } = entry;
  const example = `\`"source": "./plugins/${name}"\``;
  if (isObject(source)) return { stage: 1, hint: `${where} fetches its plugin from ${typeof source.source === 'string' ? `a ${code(source.source)} source` : 'another source'}, which each teammate would have to install. Keep the plugin inside the marketplace folder and list it by a relative path, such as ${example}.` };
  if (typeof source !== 'string' || !source.trim()) return { stage: 1, hint: `${where} has no \`source\`. List its plugin by a path from the marketplace folder, such as ${example}.` };
  if (source.includes('\\')) return { stage: 1, hint: `${where} writes its \`source\` with a backslash, ${code(source)}, which Claude Code refuses on macOS and Linux. Use forward slashes, as in ${example}.` };
  if (source !== '.' && !source.startsWith('./')) return { stage: 1, hint: `${where} has the \`source\` ${code(source)}. A relative path must start with \`./\`: write \`"source": "./${source.replace(/^\/+/, '')}"\`.` };
  if (source.split('/').includes('..')) return { stage: 1, hint: `${where} has the \`source\` ${code(source)}, whose \`..\` leaves the marketplace folder. Keep the plugin inside that folder and list it as ${example}.` };

  const dir = folder(inside(marketplace.root, source));
  const manifest = inside(dir, '.claude-plugin/plugin.json');
  const found = { name, dir, manifest };
  if (!committed.has(manifest)) {
    const lists = `${where} lists ${code(`${dir || '.'}/`)}`;
    if (existsSync(join(repo.dir, manifest))) return { stage: 2, ...found, hint: commitHint(repo, manifest, dir || manifest) };
    if (dir && [...committed].some((p) => p.startsWith(`${dir}/`))) return { stage: 2, ...found, hint: `${lists}, which has no \`.claude-plugin/plugin.json\`. A plugin folder needs one, with the plugin's \`name\`: add it and commit.` };
    return { stage: 2, ...found, hint: `${lists}, where no plugin is committed. Put the plugin there, with its \`.claude-plugin/plugin.json\`, and commit it, or fix the \`source\`.` };
  }
  const plugin = manifestJson(headText(repo, manifest) ?? '');
  if (plugin.error) return { stage: 3, ...found, hint: `The committed ${code(manifest)} isn't valid JSON: ${plugin.error}` };
  const manifestName = isObject(plugin.value) ? plugin.value.name : undefined;
  if (typeof manifestName !== 'string' || !manifestName.trim()) return { stage: 3, ...found, hint: `The committed ${code(manifest)} has no \`name\`. Set \`"name": "${name}"\`, the entry's name, and commit.` };
  if (manifestName !== name) return { stage: 4, ...found, hint: `${where} is named ${code(name)}, but ${code(manifest)} names the plugin ${code(manifestName)}. Use one name in both places, and commit.` };
  const components = pluginComponents([...committed], dir);
  if (!componentCount(components)) return { stage: 5, ...found, hint: `The plugin in ${code(`${dir || '.'}/`)} commits no component: no skill in \`skills/<name>/SKILL.md\`, no subagent in \`agents/\` and no \`hooks/hooks.json\`. Add one and commit.` };
  return { stage: 6, ...found, ok: true, components };
}

// A committed marketplace file, reviewed. Its stage: 0, not JSON; 1, a name
// it can't use; 2, no owner name; 3, no plugin entries; 4, entries read, the
// best one's stage in `entry`. `entries` holds every reviewed entry, and
// `plugins` those that pass.
/**
 * @param {Repo} repo
 * @param {string} path
 * @param {Set<string>} committed
 * @returns {Marketplace}
 */
function reviewMarketplace(repo, path, committed) {
  const root = folder(posix.dirname(posix.dirname(path)));
  /** @type {{ path: string, root: string, entries: Entry[], plugins: Entry[] }} */
  const base = { path, root, entries: [], plugins: [] };
  const parsed = manifestJson(headText(repo, path) ?? '');
  if (parsed.error) return { ...base, stage: 0, hint: `The committed ${code(path)} isn't valid JSON: ${parsed.error}` };
  const value = parsed.value;
  if (!isObject(value)) return { ...base, stage: 0, hint: `The committed ${code(path)} isn't a JSON object with a \`name\`, an \`owner\` and a \`plugins\` list.` };
  const named = nameProblem(value.name);
  if (named) return { ...base, stage: 1, name: value.name, hint: `${code(path)} ${named}. Pick a name of your own, such as \`team-tools\`, and use it under \`extraKnownMarketplaces\` and after the \`@\` in \`enabledPlugins\` too.` };
  const marketplace = { ...base, name: value.name };
  if (!isObject(value.owner) || typeof value.owner.name !== 'string' || !value.owner.name.trim()) return { ...marketplace, stage: 2, hint: `${code(path)} needs an \`owner\` with a \`name\`, such as \`"owner": { "name": "Your team" }\`.` };
  if (!Array.isArray(value.plugins) || !value.plugins.length) return { ...marketplace, stage: 3, hint: `${code(path)} lists no plugins. Add an entry to \`plugins\`, such as \`{ "name": "team-kit", "source": "./plugins/team-kit" }\`.` };
  const entries = value.plugins.map((/** @type {unknown} */ entry, /** @type {number} */ i) => reviewEntry(repo, marketplace, entry, i, committed));
  const best = entries.reduce((a, b) => (b.stage > a.stage ? b : a));
  return { ...marketplace, stage: 4, entry: best.stage, hint: best.hint, entries, plugins: entries.filter((e) => e.ok) };
}

// The committed plugin folders: each holds a committed
// .claude-plugin/plugin.json. The root is ''.
export const pluginFolders = (/** @type {Repo} */ repo) => committedFiles(repo).filter((p) => PLUGIN.test(p)).map((p) => folder(posix.dirname(posix.dirname(p))));

// Every committed marketplace file, reviewed, read once per repository.
/** @type {WeakMap<Repo, Marketplace[]>} */
const reviewed = new WeakMap();
/**
 * @param {Repo} repo
 * @returns {Marketplace[]}
 */
export function committedMarketplaces(repo) {
  if (!reviewed.has(repo)) {
    const files = committedFiles(repo);
    const committed = new Set(files);
    reviewed.set(repo, files.filter((p) => MARKETPLACE.test(p)).map((path) => reviewMarketplace(repo, path, committed)));
  }
  return /** @type {Marketplace[]} */ (reviewed.get(repo));
}

// The marketplaces that pass: a usable name, an owner, and at least one entry
// that lists a committed plugin by a relative path, with matching names.
export const passingMarketplaces = (/** @type {Repo} */ repo) => committedMarketplaces(repo).filter((m) => m.plugins.length);

// Why no committed marketplace passes. `start` says how to make one when
// there is none, as the page describes it.
/**
 * @param {Repo} repo
 * @returns {string}
 */
export function marketplaceHint(repo, start = 'Download the example marketplace into `team-marketplace/`, as the Worked example shows') {
  const all = committedMarketplaces(repo);
  if (all.length) {
    const rank = (/** @type {Marketplace} */ m) => m.stage * 10 + (m.entry ?? 0);
    // None passes, so the best one has a hint.
    return /** @type {string} */ (all.reduce((a, b) => (rank(b) > rank(a) ? b : a)).hint);
  }
  const [loose] = uncommittedFiles(repo, '.claude-plugin/marketplace.json');
  if (loose) return commitHint(repo, loose, folder(posix.dirname(posix.dirname(loose))) || loose);
  const renamed = committedFiles(repo).find((p) => RENAMED.test(p)) ?? uncommittedFiles(repo, 'dot-claude-plugin/marketplace.json')[0];
  if (renamed) {
    const from = posix.dirname(renamed);
    const to = inside(folder(posix.dirname(from)), '.claude-plugin');
    return `${code(`${from}/`)} isn't a marketplace until it's named \`.claude-plugin/\`: Claude Code reads a marketplace from \`.claude-plugin/marketplace.json\`. Run \`git mv ${shell(from)} ${shell(to)}\` (or \`mv\`, if it isn't committed yet), and commit.`;
  }
  return `There is no committed \`.claude-plugin/marketplace.json\`. ${start}, and commit it.`;
}

// The committed .claude/settings.json: `{ value }`, `{ error }`, or null when
// HEAD has none.
/** @param {Repo} repo */
export function committedSettings(repo) {
  const text = headText(repo, SETTINGS);
  return text === null ? null : parseJson(text);
}

const BLOCK = (/** @type {string} */ name, /** @type {string} */ dir) => `\`"extraKnownMarketplaces": { "${name}": { "source": { "source": "directory", "path": "${relativePath(dir)}" } } }\``;

// Where a settings source points, as a folder relative to the repository, or
// a problem with it, as `{ dir }` or `{ hint }`.
/**
 * @param {unknown} source
 * @param {string} key
 * @param {Marketplace} marketplace
 * @returns {{ dir: string, hint?: undefined } | { hint: string, dir?: undefined }}
 */
function sourceFolder(source, key, marketplace) {
  const want = relativePath(marketplace.root);
  const label = `\`${key}.${marketplace.name}\``;
  if (!isObject(source)) return { hint: `${label} has no \`source\` object. Write ${BLOCK(marketplace.name, marketplace.root)}.` };
  const type = source.source;
  if (type !== 'directory' && type !== 'file') return { hint: `${label} registers the marketplace from ${typeof type === 'string' ? `a ${code(type)} source` : 'a source without a type'}. Register the committed folder instead: \`"source": { "source": "directory", "path": "${want}" }\`.` };
  const { path } = source;
  const target = type === 'directory' ? want : `${want}/.claude-plugin/marketplace.json`;
  if (typeof path !== 'string' || !path.trim()) return { hint: `${label} has no \`path\`. Write \`"path": "${target}"\`.` };
  if (/^(?:\/|~|[A-Za-z]:|\\\\)/.test(path)) return { hint: `${label} has the \`path\` ${code(path)}, a path on your machine, which a teammate's clone doesn't have. Write it relative to the repository: \`"path": "${target}"\`.` };
  if (path.includes('\\')) return { hint: `${label} writes its \`path\` with a backslash, ${code(path)}, which isn't a folder separator on macOS or Linux. Write \`"path": "${target}"\`.` };
  if (path.split('/').includes('..')) return { hint: `${label} has the \`path\` ${code(path)}, whose \`..\` leaves the repository. Write \`"path": "${target}"\`.` };
  const resolved = type === 'directory' ? folder(path) : folder(path) === inside(marketplace.root, '.claude-plugin/marketplace.json') ? marketplace.root : null;
  if (resolved !== marketplace.root) return { hint: `${label} has the \`path\` ${code(path)}, but the marketplace is in ${code(marketplace.path)}. Write \`"path": "${target}"\`.` };
  return { dir: resolved };
}

// How far settings get for one marketplace: 0, no marketplace registered;
// 1, not under its name; 2, a source that doesn't point at it; 3, its plugin
// isn't turned on; 4, passes. Returns `{ stage, hint }`.
/**
 * @param {Json} settings
 * @param {Marketplace} marketplace
 * @returns {{ stage: number, hint?: string }}
 */
function reviewRegistration(settings, marketplace) {
  const { name, root } = marketplace;
  const canonical = own(settings, 'extraKnownMarketplaces');
  const key = canonical ? 'extraKnownMarketplaces' : 'additionalMarketplaces';
  const known = settings[key];
  if (!isObject(known)) return { stage: 0, hint: `The committed \`${SETTINGS}\` registers no marketplace. Add ${BLOCK(name, root)} and commit.` };
  if (!own(known, name)) {
    if (canonical && own(settings.additionalMarketplaces, name)) return { stage: 1, hint: `The committed \`${SETTINGS}\` sets both \`extraKnownMarketplaces\` and its other spelling, \`additionalMarketplaces\`, and Claude Code then reads only \`extraKnownMarketplaces\`, so ${code(name)} under \`additionalMarketplaces\` is ignored. Move it into \`extraKnownMarketplaces\` and commit.` };
    const other = Object.keys(known).find((k) => sourceFolder(known[k]?.source, key, { ...marketplace, name: k }).dir === root);
    if (other !== undefined) return { stage: 1, hint: `\`${key}\` registers the marketplace under the key ${code(other)}, but the key must be the marketplace's \`name\` from ${code(marketplace.path)}, ${code(name)}. Rename the key, and commit.` };
    return { stage: 1, hint: `\`${key}\` in the committed \`${SETTINGS}\` registers no marketplace named ${code(name)}. Add ${BLOCK(name, root)} and commit.` };
  }
  const where = sourceFolder(known[name]?.source, key, marketplace);
  if (where.hint) return { stage: 2, hint: `${where.hint} Then commit.` };
  const enabled = isObject(settings.enabledPlugins) ? settings.enabledPlugins : {};
  const ids = marketplace.plugins.map((p) => `${p.name}@${name}`);
  if (ids.some((id) => enabled[id] === true)) return { stage: 4 };
  const [id] = ids;
  const add = `\`"enabledPlugins": { "${id}": true }\``;
  const set = ids.find((i) => own(enabled, i));
  if (set !== undefined) {
    const value = enabled[set];
    if (value === false) return { stage: 3, hint: `\`enabledPlugins\` in the committed \`${SETTINGS}\` turns ${code(set)} off. Set it to \`true\`, so the plugin is on for everyone, and turn it off for yourself only in \`.claude/settings.local.json\`. Then commit.` };
    return { stage: 3, hint: `\`enabledPlugins\` sets ${code(set)} to ${code(JSON.stringify(value))}. Use the JSON boolean \`true\`, without quotes, and commit.` };
  }
  const plugins = marketplace.plugins.map((p) => p.name);
  const elsewhere = Object.keys(enabled).find((k) => plugins.includes(k.split('@')[0]) && k.includes('@'));
  if (elsewhere) return { stage: 3, hint: `\`enabledPlugins\` turns on ${code(elsewhere)}, but the part after \`@\` must be the marketplace's \`name\`, ${code(name)}: write ${code(`"${elsewhere.split('@')[0]}@${name}": true`)}, and commit.` };
  return { stage: 3, hint: `The committed \`${SETTINGS}\` registers ${code(name)} but turns none of its plugins on. Add ${add} and commit.` };
}

// Whether settings register one of `marketplaces` by a relative path and turn
// one of its plugins on: `{ ok: true }` or `{ ok: false, stage, hint }`.
/**
 * @param {unknown} settings
 * @param {Marketplace[]} marketplaces
 * @returns {{ ok: boolean, stage?: number, hint?: string | null }}
 */
export function registration(settings, marketplaces) {
  if (!marketplaces.length) return { ok: false, stage: -1, hint: null };
  const results = marketplaces.map((m) => reviewRegistration(isObject(settings) ? settings : {}, m));
  const best = results.reduce((a, b) => (b.stage > a.stage ? b : a));
  return best.stage === 4 ? { ok: true } : { ok: false, ...best };
}
