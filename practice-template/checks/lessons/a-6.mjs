// @ts-check
// Share your setup with a team (Advanced, lesson 6). The Learner commits a
// team marketplace inside the repository, copied from the guide's example,
// registers it in the committed .claude/settings.json by a relative path and
// turns its plugin on; moves a skill, a subagent or a hook of their own from
// .claude/ into the plugin; keeps their personal files out of git with a
// committed .gitignore; and saves a strict validation of the plugin
// directory, which shares the first item with the marketplace. Why the plugin
// needs no install command, where Intermediate lesson 8's did, is a
// self-check. The Advanced capstone reuses the marketplace items.
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join, posix, relative } from 'node:path';
import { frontmatter } from '../frontmatter.mjs';
import { committedIgnore, ignoreHint } from '../ignore.mjs';
import {
  commitHint, committedFiles, committedMarketplaces, committedSettings, headText, marketplaceHint,
  parseJson, passingMarketplaces, pluginComponents, pluginFolders, registration, relativePath, uncommittedFiles,
} from '../marketplace.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */
/** @import { Marketplace, Entry } from '../marketplace.mjs' */

export const title = 'Share your setup with a team';

export const VALIDATE = '.practice/a-6-validate.json';
const SETTINGS = '.claude/settings.json';
const PERSONAL = ['.claude/settings.local.json', 'CLAUDE.local.md'];
// The example plugin, as the Worked example copies it, and the components it
// already holds.
const EXAMPLE = { name: 'team-kit', dir: 'team-marketplace/plugins/team-kit' };
const KIT = new Set(['skills/onboard/SKILL.md', 'agents/config-reviewer.md']);
// The /tutor skill that earlier versions of the practice template shipped in
// .claude/skills/tutor/, which an older copy may still hold. Moving it into the
// plugin doesn't move a component of the Learner's own.
const TUTOR = 'skills/tutor/SKILL.md';
// Words of a hook command that name an interpreter, not the script it runs.
const INTERPRETERS = new Set(['bash', 'sh', 'zsh', 'node', 'python', 'python3', 'env', 'deno', 'bun', 'ruby', 'perl', 'pwsh']);
const PLUGIN_ROOT = /^\$\{?CLAUDE_PLUGIN_ROOT\}?\/(.+)$/;

const and = (/** @type {unknown[]} */ list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]);
const code = (/** @type {string} */ text) => `\`${text}\``;
const shell = (/** @type {string} */ path) => (/\s/.test(path) ? `"${path}"` : path);
/** @type {(value: unknown) => value is Record<string, any>} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const named = (/** @type {unknown} */ value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// The plugins committed marketplaces list by a relative path, with a
// committed plugin.json, the passing ones first.
// An entry at stage 3 or later has its plugin's name and folder.
/**
 * @param {Repo} repo
 * @returns {{ name: string, dir: string }[]}
 */
function listedPlugins(repo) {
  const passing = passingMarketplaces(repo).flatMap((m) => m.plugins);
  const others = committedMarketplaces(repo).flatMap((m) => m.entries).filter((e) => e.stage >= 3 && !passing.includes(e));
  const seen = new Set();
  return /** @type {{ name: string, dir: string }[]} */ ([...passing, ...others].filter((p) => !seen.has(p.dir) && seen.add(p.dir)));
}

// The plugin a hint names: the first that passes, or the example's.
const mainPlugin = (/** @type {Repo} */ repo) => listedPlugins(repo)[0] ?? EXAMPLE;

// What the hints say to do when there is no marketplace or no settings yet,
// as the lesson's page says it. The Advanced capstone passes its own.
/** @typedef {{ marketplace: string, settings: string }} Page */

/** @type {Page} */
const LESSON = {
  marketplace: 'Download the example marketplace into `team-marketplace/`, as the Worked example shows',
  settings: 'as the Worked example shows',
};

/** @returns {Item} */
export function marketplaceItem(page = LESSON) {
  return {
    text: 'a committed team marketplace lists a plugin by a relative path, and the entry\'s name matches the `name` in the plugin\'s `plugin.json`',
    check: (/** @type {Repo} */ repo) => (passingMarketplaces(repo).length ? true : marketplaceHint(repo, page.marketplace)),
  };
}

// Whether the working copy of the settings would pass where the committed
// one doesn't: then the fix only needs committing.
/**
 * @param {Repo} repo
 * @param {Marketplace[]} marketplaces
 */
function pendingSettings(repo, marketplaces) {
  // repo.read drops a byte-order mark, which the committed text keeps.
  const text = repo.read(SETTINGS);
  if (text === null || text.trimEnd() === (headText(repo, SETTINGS) ?? '').replace(/^\uFEFF/, '').trimEnd()) return false;
  try {
    return registration(JSON.parse(text), marketplaces).ok;
  } catch {
    return false;
  }
}

/**
 * @param {Repo} repo
 * @param {ReturnType<typeof committedSettings>} settings
 * @param {Marketplace[]} marketplaces
 * @param {Page} page
 */
function settingsHint(repo, settings, marketplaces, page) {
  if (settings === null) {
    if (repo.exists(SETTINGS)) return commitHint(repo, SETTINGS);
    // The caller passes at least one passing marketplace, with a plugin.
    const [m] = /** @type {[Marketplace]} */ (marketplaces);
    return `There is no committed ${code(SETTINGS)}. Create it with ${code(m.name)} under \`extraKnownMarketplaces\`, at the path ${code(relativePath(m.root))}, and \`"enabledPlugins": { "${/** @type {Entry} */ (m.plugins[0]).name}@${m.name}": true }\`, ${page.settings}, and commit it.`;
  }
  if (settings.error) return `The committed ${code(SETTINGS)} isn't valid JSON: ${settings.error}`;
  if (!isObject(settings.value)) return `The committed ${code(SETTINGS)} isn't a JSON object.`;
  const result = registration(settings.value, marketplaces);
  // A registration that fails has a hint.
  return result.ok ? null : /** @type {string} */ (result.hint);
}

/** @returns {Item} */
export function settingsItem(page = LESSON) {
  return {
    text: 'the committed `.claude/settings.json` registers that marketplace by a relative path and turns the plugin on',
    check(repo) {
      const marketplaces = passingMarketplaces(repo);
      if (!marketplaces.length) return 'No committed marketplace passes the item above yet, so the check can\'t tell which one `.claude/settings.json` should register. Fix that first.';
      const settings = committedSettings(repo);
      const hint = settingsHint(repo, settings, marketplaces, page);
      if (hint === null) return true;
      if (settings !== null && pendingSettings(repo, marketplaces)) return `Your copy of ${code(SETTINGS)} registers the marketplace and turns the plugin on, but that change isn't committed. Run \`git add ${SETTINGS}\` and commit it.`;
      return hint;
    },
  };
}

export const teamMarketplace = marketplaceItem();
export const sharedSettings = settingsItem();

// The frontmatter fields of a committed file.
const fieldsOf = (/** @type {Repo} */ repo, /** @type {string} */ path) => frontmatter(headText(repo, path) ?? '')?.fields ?? {};

// The names a skill runs under. A project skill runs by its folder's name and
// by its frontmatter `name`; a plugin skill takes its `name` in place of the
// folder's, after the plugin's prefix.
/**
 * @param {Repo} repo
 * @param {string} path
 * @param {boolean} inPlugin
 */
function skillNames(repo, path, inPlugin) {
  const folder = path.split('/').at(-2);
  const name = named(fieldsOf(repo, path).name)?.split(':').pop();
  if (inPlugin) return [name ?? folder];
  return [...new Set([folder, name].filter(Boolean))];
}

// The name a subagent loads under: its frontmatter `name`; a plugin's
// subagent without one takes its file's name.
/**
 * @param {Repo} repo
 * @param {string} path
 * @param {boolean} inPlugin
 */
function agentName(repo, path, inPlugin) {
  const name = named(fieldsOf(repo, path).name)?.split(':').pop();
  return name ?? (inPlugin ? posix.basename(path, '.md') : null);
}

// The hook handlers in a settings-shaped `hooks` object.
/**
 * @param {unknown} hooks
 * @returns {Record<string, any>[]}
 */
function handlers(hooks) {
  if (!isObject(hooks)) return [];
  return Object.values(hooks)
    .flatMap((groups) => (Array.isArray(groups) ? groups : []))
    .flatMap((group) => (Array.isArray(group?.hooks) ? group.hooks : []))
    .filter((h) => isObject(h) && typeof h.type === 'string');
}

// The script paths a command hook names, as written: the words of its command
// and args that look like a file path.
/**
 * @param {Record<string, any>} handler
 * @returns {string[]}
 */
function scripts(handler) {
  if (handler.type !== 'command') return [];
  return [handler.command, ...(Array.isArray(handler.args) ? handler.args : [])]
    .flatMap((t) => String(t ?? '').split(/\s+/))
    .map((w) => w.replace(/["']/g, '').replace(/\\/g, '/'))
    .filter((w) => w && !/[<>|&;]/.test(w) && w !== '/dev/null' && (w.includes('/') || /\.(?:sh|bash|zsh|py|[cm]?js|ts|rb|pl|ps1)$/.test(w)))
    .filter((w) => !INTERPRETERS.has(posix.basename(w)));
}
const commandOf = (/** @type {Record<string, any>} */ h) => (h.type === 'command' ? [h.command, ...(Array.isArray(h.args) ? h.args : [])].map((t) => String(t ?? '').trim()).join(' ') : null);

// What the committed .claude/ still holds: each skill and subagent with the
// names it loads under, and the settings' command hooks.
/**
 * @param {Repo} repo
 * @param {string[]} files
 */
function projectSetup(repo, files) {
  const settings = committedSettings(repo);
  return {
    skills: files.filter((p) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(p)).map((path) => ({ path, names: skillNames(repo, path, false) })),
    agents: files.filter((p) => /^\.claude\/agents\/.+\.md$/.test(p)).map((path) => ({ path, name: agentName(repo, path, false) })),
    hooks: settings?.value ? handlers(settings.value.hooks) : [],
  };
}

// Whether a plugin's hooks/hooks.json holds a hook moved out of .claude/:
// `{ ok }` or `{ hint }`.
/**
 * @param {Repo} repo
 * @param {{ name: string, dir: string }} plugin
 * @param {string} path
 * @param {ReturnType<typeof projectSetup>} project
 * @param {Set<string>} committed
 * @returns {{ ok?: unknown, hint?: string | undefined }}
 */
function reviewHooks(repo, plugin, path, project, committed) {
  const parsed = parseJson(headText(repo, path) ?? '');
  if (parsed.error) return { hint: `The committed ${code(path)} isn't valid JSON: ${parsed.error}` };
  const list = handlers(parsed.value?.hooks);
  if (!list.length) return { hint: `The committed ${code(path)} holds no hook. Put the entry under a top-level \`hooks\` key, in the same shape as in a settings file.` };
  /** @type {string[]} */
  const problems = [];
  const theirs = project.hooks.map((h) => ({ command: commandOf(h), names: scripts(h).map((s) => posix.basename(s)) }));
  for (const h of list) {
    const words = scripts(h);
    const twice = theirs.find((t) => (t.command && t.command === commandOf(h)) || t.names.some((n) => words.some((w) => posix.basename(w) === n)));
    const stays = words.find((w) => /(^|\/)\.claude\//.test(w));
    const missing = words.map((w) => w.match(PLUGIN_ROOT)?.[1]).filter(Boolean).map((rel) => `${plugin.dir ? `${plugin.dir}/` : ''}${posix.normalize(/** @type {string} */ (rel))}`).find((p) => !committed.has(p));
    if (twice) problems.push(`\`${SETTINGS}\` still runs the same hook${twice.names.length ? `, ${code(/** @type {string} */ (twice.names[0]))}` : ''}, so it would run twice each time its event fires. Remove that hook from \`${SETTINGS}\` and commit.`);
    else if (stays) problems.push(`The plugin's hook still runs ${code(stays)}, a script in \`.claude/\`. Move the script into the plugin, call it as \`\${CLAUDE_PLUGIN_ROOT}/<path in the plugin>\`, and commit.`);
    else if (missing) {
      problems.push(existsSync(join(repo.dir, missing))
        ? `The hook in ${code(path)} runs ${code(missing)}, but ${commitHint(repo, missing).replace(/^`[^`]+` /, 'it ')}`
        : `The hook in ${code(path)} runs ${code(missing)}, which isn't in the plugin. Put the script there, or fix the path after \`\${CLAUDE_PLUGIN_ROOT}/\`, and commit.`);
    }
    else return { ok: true };
  }
  return { hint: problems[0] };
}

/** @type {Item} */
export const movedComponent = {
  text: 'a component you moved is in the plugin and gone from `.claude/`',
  check(repo) {
    const plugins = listedPlugins(repo);
    if (!plugins.length) return 'No committed marketplace lists a committed plugin yet, so there is nowhere to move a component to. Pass the first item, then move a skill, a subagent or a hook into the plugin.';
    const files = committedFiles(repo);
    const committed = new Set(files);
    const project = projectSetup(repo, files);
    /** @type {{ ok?: unknown, hint?: string | undefined }[]} */
    const tried = [];
    for (const plugin of plugins) {
      const { skills, agents, hooks } = pluginComponents(files, plugin.dir);
      for (const { path, rel } of skills.filter((s) => !KIT.has(s.rel) && s.rel !== TUTOR)) {
        const [name] = skillNames(repo, path, true);
        const twin = project.skills.find((s) => s.names.includes(/** @type {string} */ (name)));
        tried.push(twin ? { hint: `${code(path)} is in the plugin, but ${code(twin.path)} is still committed, so the skill loads twice, as \`/${name}\` and \`/${plugin.name}:${name}\`. Run \`git rm -r ${shell(posix.dirname(twin.path))}\` and commit.` } : { ok: rel });
      }
      for (const { path, rel } of agents.filter((a) => !KIT.has(a.rel))) {
        const name = agentName(repo, path, true);
        const twin = project.agents.find((a) => a.name === name);
        tried.push(twin ? { hint: `${code(path)} is in the plugin, but ${code(twin.path)} is still committed, so the subagent loads twice, as ${code(/** @type {string} */ (name))} and ${code(`${plugin.name}:${name}`)}. Run \`git rm ${shell(twin.path)}\` and commit.` } : { ok: rel });
      }
      for (const { path } of hooks) tried.push(reviewHooks(repo, plugin, path, project, committed));
    }
    if (tried.some((t) => t.ok)) return true;
    if (tried.length) return /** @type {string} */ (/** @type {{ hint?: string }} */ (tried[0]).hint);
    // Nothing beyond the example's own components is committed.
    const component = /^(?:skills\/[^/]+\/SKILL\.md|agents\/.+\.md|hooks\/hooks\.json)$/;
    const loose = ['skills/*/SKILL.md', 'agents/**/*.md', 'hooks/hooks.json']
      .flatMap((pattern) => uncommittedFiles(repo, pattern))
      .find((p) => plugins.some((pl) => {
        const rel = p.slice(pl.dir ? pl.dir.length + 1 : 0);
        return p.startsWith(pl.dir ? `${pl.dir}/` : '') && component.test(rel) && rel !== TUTOR;
      }));
    if (loose) return commitHint(repo, loose);
    const tutor = plugins.map((pl) => `${pl.dir ? `${pl.dir}/` : ''}${TUTOR}`).find((p) => committed.has(p));
    if (tutor) {
      // Still committed at its own path, the plugin's tutor is a copy: remove it rather than move it back.
      const fix = committed.has(`.claude/${TUTOR}`) ? `Remove the copy with \`git rm -r ${shell(posix.dirname(tutor))}\`` : 'Move it back to `.claude/skills/tutor/` with `git mv`';
      return `The plugin's \`/tutor\` skill came with the practice copy, so it isn't one of your own. ${fix}, then move one of your own into the plugin, and commit.`;
    }
    const [{ dir }] = /** @type {[{ name: string, dir: string }]} */ (plugins);
    return `The plugin holds only the example's \`onboard\` skill and \`config-reviewer\` subagent. Move a skill, a subagent or a hook of your own into ${dir ? code(`${dir}/`) : 'the plugin'}, as Your turn describes, with \`git mv\` so the original leaves \`.claude/\`. Then commit.`;
  },
};

/**
 * @param {Repo} repo
 * @param {string[]} args
 */
function tracked(repo, ...args) {
  try {
    return Boolean(repo.git(...args));
  } catch {
    return false;
  }
}

/** @type {Item} */
export const personalFiles = {
  text: 'a committed `.gitignore` keeps `.claude/settings.local.json` and `CLAUDE.local.md` out, and git tracks neither',
  check(repo) {
    /** @type {string[]} */
    const problems = [];
    /** @type {string[]} */
    const unruled = [];
    for (const path of PERSONAL) {
      if (tracked(repo, 'ls-files', '--', path)) {
        problems.push(`git tracks ${code(path)}, which is yours alone. Run \`git rm --cached ${path}\`, add the line ${code(path)} to \`.gitignore\`, and commit.`);
      } else if (tracked(repo, 'ls-tree', '--name-only', 'HEAD', '--', path)) {
        problems.push(`${code(path)} is still in your last commit. Commit its removal.`);
      } else {
        const rule = committedIgnore(repo, path);
        if (rule.problem === 'none') unruled.push(path);
        else if (rule.problem) problems.push(ignoreHint(rule, path));
      }
    }
    if (unruled.length > 1) problems.push(`No committed \`.gitignore\` ignores ${and(unruled.map(code))}. Add the lines ${and(unruled.map(code))} to \`.gitignore\` and commit it. A rule in your global git excludes file doesn't count: it isn't in the repository.`);
    else if (unruled.length) problems.push(ignoreHint({ problem: 'none' }, /** @type {string} */ (unruled[0])));
    return problems.length ? problems.join(' ') : true;
  },
};

const real = (/** @type {string} */ path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

// Messages from a failed report: its errors first, then the warnings that
// --strict counts as errors.
/**
 * @param {Record<string, any>} report
 * @returns {string[]}
 */
function messages(report) {
  const results = [report.manifest, ...(Array.isArray(report.contents) ? report.contents : [])].filter(isObject);
  const text = (/** @type {any} */ m) => (typeof m === 'string' ? m : typeof m?.message === 'string' ? m.message : null);
  return ['errors', 'warnings'].flatMap((k) => results.flatMap((r) => (Array.isArray(r[k]) ? r[k] : []))).map(text).filter(Boolean);
}

// The saved report of `claude plugin validate <plugin folder> --strict --json`.
/** @returns {Item} */
export function strictValidation(record = VALIDATE) {
  return {
    text: `${code(record)} records a strict validation of the plugin directory that passed`,
    local: true,
    check(repo) {
      const plugin = mainPlugin(repo);
      const save = `\`claude plugin validate ${shell(relativePath(plugin.dir))} --strict --json > ${record}\``;
      const text = repo.read(record);
      if (text === null || !text.trim()) return `There is no ${code(record)} yet. From the repository's root, once the plugin is in place, run ${save}.`;
      let report;
      try {
        report = JSON.parse(text);
      } catch {
        if (/Validation (passed|failed)/.test(text)) return `${code(record)} holds the text report. Save the JSON one, with \`--json\`: ${save}.`;
        return `${code(record)} isn't JSON. Save the report unchanged: ${save}.`;
      }
      if (!isObject(report) || !('success' in report)) return `${code(record)} isn't a report from \`claude plugin validate --json\`: it has no \`success\`. Save it again: ${save}.`;
      if (report.success !== true) {
        const found = messages(report);
        const said = found.length ? ` It reports: ${found.slice(0, 2).map(code).join('; ')}${found.length > 2 ? `, and ${found.length - 2} more` : ''}.` : '';
        return `${code(record)} records a validation that failed.${said} Fix what it reports, then save the report again: ${save}.`;
      }
      if (report.strict !== true) return `${code(record)} records a validation without \`--strict\`, which lets warnings through. Run it with \`--strict\`: ${save}.`;
      const target = typeof report.target === 'string' ? report.target.trim() : '';
      if (!target) return `${code(record)} has no \`target\`, so the check can't tell what was validated. Save the report unchanged: ${save}.`;
      const slashed = target.replace(/\\/g, '/');
      if (/(?:^|\/)\.claude-plugin\/marketplace\.json$/.test(slashed)) return `${code(record)} records a validation of the marketplace, which doesn't open the plugin's skill and agent files. Validate the plugin directory: ${save}.`;
      const dirs = pluginFolders(repo);
      if (!dirs.length) return `There is no committed plugin directory, a folder with \`.claude-plugin/plugin.json\`, for ${code(record)} to match. Commit the plugin, then save the report again: ${save}.`;
      const listed = and(dirs.map((d) => code(relativePath(d))));
      const where = real(target);
      if (where !== null) {
        const ok = dirs.some((d) => {
          const base = real(join(repo.dir, d));
          return base !== null && (where === base || where === join(base, '.claude-plugin', 'plugin.json'));
        });
        if (ok) return true;
        const rel = relative(real(repo.dir) ?? repo.dir, where);
        if (!rel || rel.startsWith('..') || isAbsolute(rel)) return `${code(record)} records a validation of ${code(target)}, ${rel ? 'outside this repository' : 'the repository itself'}, not of a plugin directory in it. Validate the plugin folder again, from the repository's root.`;
        return `${code(record)} records a validation of ${code(rel.replace(/\\/g, '/'))}, which isn't a committed plugin directory (${listed}). Run ${save}.`;
      }
      // A path that isn't on this machine was saved elsewhere: it must end in
      // a committed plugin folder, or in that folder's plugin.json.
      const parts = slashed.split('/').filter(Boolean);
      const ends = (/** @type {string[]} */ tail) => tail.length <= parts.length && tail.every((s, i) => parts[parts.length - tail.length + i] === s);
      if (dirs.some((d) => {
        const own = d ? d.split('/') : [];
        return (own.length && ends(own)) || ends([...own, '.claude-plugin', 'plugin.json']);
      })) return true;
      return `${code(record)} records a validation of ${code(target)}, which isn't on this machine and doesn't end in a committed plugin directory. Validate the plugin folder again, from the repository's root.`;
    },
  };
}

// The lesson's first item: the marketplace passes, and the plugin it lists
// passed a strict validation. One item, so the page names one structure
// check; the capstone keeps the marketplace item on its own.
const validation = strictValidation();
/** @type {Item} */
export const validatedMarketplace = {
  text: `a committed team marketplace lists a plugin by a relative path, and ${code(VALIDATE)} records a strict validation of that plugin that passed`,
  local: true,
  check(repo) {
    const market = teamMarketplace.check(repo);
    return market === true ? validation.check(repo) : market;
  },
};

/** @type {Item[]} */
export const items = [validatedMarketplace, sharedSettings, movedComponent, personalFiles];
