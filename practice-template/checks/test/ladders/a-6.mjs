// Every FAIL message family of Advanced lesson 6's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario holds one problem, so its message matches one narrow question.
// The work folder starts as a repository after the Intermediate lessons: a
// tdd skill, a test-gaps subagent and a protect-files hook in .claude/.
import { execFileSync } from 'node:child_process';
import { realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const git = (dir, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });

const SETTINGS = '.claude/settings.json';
const VALIDATE = '.practice/a-6-validate.json';
const ROOT = 'team-marketplace';
const KIT = `${ROOT}/plugins/team-kit`;
const HOOK_SCRIPT = '.claude/hooks/protect-files.sh';
const HOOKS = { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: `\${CLAUDE_PROJECT_DIR}/${HOOK_SCRIPT}`, args: [] }] }] };
const BASE = { permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)'] }, hooks: HOOKS };
const MARKET = { name: 'team-tools', description: 'A demo team marketplace.', owner: { name: 'Your team' }, plugins: [{ name: 'team-kit', source: './plugins/team-kit', description: 'The team\'s shared skills and subagents' }] };
const REGISTER = { 'team-tools': { source: { source: 'directory', path: './team-marketplace' } } };
const SHARED = { ...BASE, extraKnownMarketplaces: REGISTER, enabledPlugins: { 'team-kit@team-tools': true } };
const IGNORE = '.practice/\n.claude/settings.local.json\nCLAUDE.local.md\n';
const START = {
  'README.md': '# demo\n',
  [SETTINGS]: json(BASE),
  '.claude/skills/tdd/SKILL.md': '---\nname: tdd\ndescription: Builds a feature test first, then the code, then refactors.\n---\n\nWrite a failing test first.\n',
  '.claude/agents/test-gaps.md': '---\nname: test-gaps\ndescription: Lists the functions that no test calls.\ntools: Read, Grep, Glob\n---\n\nList them.\n',
  [HOOK_SCRIPT]: '#!/bin/bash\nexit 0\n',
};
const PLUGIN = (name = 'team-kit') => ({
  [`${KIT}/.claude-plugin/plugin.json`]: json({ name, version: '0.1.0', description: 'A team\'s shared setup', author: { name: 'Your team' } }),
  [`${KIT}/skills/onboard/SKILL.md`]: '---\nname: onboard\ndescription: Explains the shared setup to a new teammate.\n---\n\nExplain it.\n',
  [`${KIT}/agents/config-reviewer.md`]: '---\nname: config-reviewer\ndescription: Reviews the shared configuration.\ntools: Read, Grep, Glob\n---\n\nReview it.\n',
});
// What `claude plugin validate <dir> --strict --json` saves.
const report = (target, extra = {}) => ({ success: true, strict: true, target, manifest: { file: target, type: 'plugin', errors: [], warnings: [], notes: [] }, contents: [], ...extra });
const VALID = (dir) => report(join(realpathSync(dir), KIT, '.claude-plugin', 'plugin.json'));
const MARKET_PATH = `${ROOT}/.claude-plugin/marketplace.json`;
const PLUGIN_PATH = `${KIT}/.claude-plugin/plugin.json`;
// The marketplace file as `text`, or the example's with `change` applied.
const marketWith = (change) => ({ [MARKET_PATH]: typeof change === 'string' ? change : json({ ...MARKET, ...change }) });
const entry = (value) => marketWith({ plugins: [value] });
const registered = (source) => ({ ...SHARED, extraKnownMarketplaces: { 'team-tools': source === undefined ? {} : { source } } });
const PLUGIN_HOOK = (command) => json({ hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command }] }] } });

// The finished lesson, with one step changed: `start` (the Intermediate
// setup and an optional .gitignore), `market` (the marketplace file at its
// path), `plugin` (the plugin's files), `settings` (null for none), `move`
// ([from, to] pairs moved with git mv before the last commit), `files`
// (written, or deleted with null, before it), `commitAll` (false leaves the
// last step uncommitted), `report` (the saved validation, a function of the
// folder, text, or null) and `after` (a last change).
function share({
  gitignore = IGNORE, market = { [`${ROOT}/.claude-plugin/marketplace.json`]: json(MARKET) }, plugin = PLUGIN(), settings = SHARED,
  move = [['.claude/agents/test-gaps.md', `${KIT}/agents/test-gaps.md`]], files = {}, commitAll = true, report: saved = VALID, after,
} = {}) {
  return (dir, { write, commit }) => {
    write(dir, { ...START, ...(gitignore === null ? {} : { '.gitignore': gitignore }) });
    commit(dir, 'Start');
    write(dir, { ...market, ...plugin });
    if (settings === null) rmSync(join(dir, SETTINGS));
    else write(dir, { [SETTINGS]: typeof settings === 'string' ? settings : json(settings) });
    for (const [from, to] of move) {
      execFileSync('mkdir', ['-p', join(dir, to, '..')]);
      git(dir, 'mv', from, to);
    }
    for (const [path, text] of Object.entries(files)) {
      if (text === null) rmSync(join(dir, path), { recursive: true, force: true });
      else write(dir, { [path]: text });
    }
    if (commitAll) commit(dir, 'Share the team\'s Claude Code setup');
    if (saved !== null) {
      const value = typeof saved === 'function' ? saved(dir) : saved;
      write(dir, { [VALIDATE]: typeof value === 'string' ? value : json(value) });
    }
    after?.(dir, { write, commit });
  };
}

export const scenarios = [
  // Item 0: the marketplace, then the saved strict validation.
  { item: 0, name: 'no marketplace at all', setup: share({ market: {}, plugin: {}, move: [] }) },
  { item: 0, name: 'the marketplace file still in dot-claude-plugin/', setup: share({ market: { [`${ROOT}/dot-claude-plugin/marketplace.json`]: json(MARKET) } }) },
  { item: 0, name: 'the marketplace downloaded but not committed', setup: share({ commitAll: false, move: [] }) },
  { item: 0, name: 'the entry and plugin.json name the plugin differently', setup: share({ plugin: PLUGIN('team-tools-kit') }) },
  { item: 0, name: 'no saved validation', setup: share({ report: null }) },
  { item: 0, name: 'the text report saved', setup: share({ report: 'Validating plugin manifest\n✔ Validation passed\n' }) },
  { item: 0, name: 'a validation that failed', setup: share({ report: (dir) => report(join(realpathSync(dir), KIT, '.claude-plugin', 'plugin.json'), { success: false, manifest: { errors: [{ message: 'name: Required' }], warnings: [] } }) }) },
  { item: 0, name: 'a validation without --strict', setup: share({ report: (dir) => report(join(realpathSync(dir), KIT, '.claude-plugin', 'plugin.json'), { strict: false }) }) },
  { item: 0, name: 'a trailing comma in the marketplace file', setup: share({ market: marketWith('{\n  "name": "team-tools",\n}\n') }) },
  { item: 0, name: 'a marketplace file that is a list', setup: share({ market: marketWith('[]\n') }) },
  { item: 0, name: 'a reserved marketplace name', setup: share({ market: marketWith({ name: 'claude-plugins-official' }) }) },
  { item: 0, name: 'no owner', setup: share({ market: marketWith({ owner: undefined }) }) },
  { item: 0, name: 'no plugins listed', setup: share({ market: marketWith({ plugins: [] }) }) },
  { item: 0, name: 'an entry that is no object', setup: share({ market: entry('team-kit') }) },
  { item: 0, name: 'an entry with a spaced name', setup: share({ market: entry({ name: 'team kit', source: './plugins/team-kit' }) }) },
  { item: 0, name: 'a plugin fetched from GitHub', setup: share({ market: entry({ name: 'team-kit', source: { source: 'github', repo: 'team/kit' } }) }) },
  { item: 0, name: 'an entry with no source', setup: share({ market: entry({ name: 'team-kit' }) }) },
  { item: 0, name: 'a source with backslashes', setup: share({ market: entry({ name: 'team-kit', source: '.\\plugins\\team-kit' }) }) },
  { item: 0, name: 'a source without ./', setup: share({ market: entry({ name: 'team-kit', source: 'plugins/team-kit' }) }) },
  { item: 0, name: 'a source outside the marketplace', setup: share({ market: entry({ name: 'team-kit', source: './../team-kit' }) }) },
  { item: 0, name: 'the plugin hidden by an ignore rule', setup: share({ gitignore: `${IGNORE}${ROOT}/plugins/\n`, move: [] }) },
  { item: 0, name: 'a plugin folder with no plugin.json', setup: share({ plugin: { [`${KIT}/skills/onboard/SKILL.md`]: PLUGIN()[`${KIT}/skills/onboard/SKILL.md`] }, move: [] }) },
  { item: 0, name: 'an entry that points at nothing', setup: share({ plugin: {}, move: [] }) },
  { item: 0, name: 'a trailing comma in plugin.json', setup: share({ plugin: { ...PLUGIN(), [PLUGIN_PATH]: '{\n  "name": "team-kit",\n}\n' } }) },
  { item: 0, name: 'plugin.json with no name', setup: share({ plugin: { ...PLUGIN(), [PLUGIN_PATH]: json({ version: '0.1.0' }) } }) },
  { item: 0, name: 'a plugin with no component', setup: share({ plugin: { [PLUGIN_PATH]: PLUGIN()[PLUGIN_PATH] }, move: [] }) },
  { item: 0, name: 'a saved file that is no JSON', setup: share({ report: 'claude plugin validate: done\n' }) },
  { item: 0, name: 'JSON that is no validation report', setup: share({ report: { plugins: [] } }) },
  { item: 0, name: 'a report with no target', setup: share({ report: report('') }) },
  { item: 0, name: 'a validation of a folder outside the repository', setup: share({ report: () => report(realpathSync(tmpdir())) }) },
  { item: 0, name: 'a validation of a folder that is no plugin', setup: share({ report: (dir) => report(join(realpathSync(dir), ROOT, 'plugins')) }) },
  { item: 0, name: 'a validation saved on another machine', setup: share({ report: report('/home/someone/elsewhere/team-kit') }) },
  { item: 0, name: 'the marketplace validated in place of the plugin', setup: share({ report: (dir) => report(join(realpathSync(dir), ROOT, '.claude-plugin', 'marketplace.json')) }) },

  // Item 1: the shared settings.
  { item: 1, name: 'no committed marketplace yet', setup: share({ market: {}, plugin: {}, move: [] }) },
  { item: 1, name: 'no shared settings file', setup: share({ settings: null, move: [] }) },
  { item: 1, name: 'the shared settings file not committed', setup: share({ settings: null, move: [], after: (dir, { write }) => write(dir, { [SETTINGS]: json(SHARED) }) }) },
  { item: 1, name: 'the registration made but not committed', setup: share({ settings: BASE, after: (dir, { write }) => write(dir, { [SETTINGS]: json(SHARED) }) }) },
  { item: 1, name: 'no marketplace registered', setup: share({ settings: { ...BASE, enabledPlugins: { 'team-kit@team-tools': true } } }) },
  { item: 1, name: 'the marketplace registered under another key', setup: share({ settings: { ...SHARED, extraKnownMarketplaces: { 'team-marketplace': REGISTER['team-tools'] } } }) },
  { item: 1, name: 'the path on one machine', setup: share({ settings: { ...SHARED, extraKnownMarketplaces: { 'team-tools': { source: { source: 'directory', path: '/home/me/repo/team-marketplace' } } } } }) },
  { item: 1, name: 'the plugin turned on with a string', setup: share({ settings: { ...SHARED, enabledPlugins: { 'team-kit@team-tools': 'true' } } }) },
  { item: 1, name: 'a trailing comma in the shared settings', setup: share({ settings: '{\n  "enabledPlugins": {},\n}\n' }) },
  { item: 1, name: 'shared settings that are a list', setup: share({ settings: '[]\n' }) },
  { item: 1, name: 'the marketplace under the other spelling too', setup: share({ settings: { ...SHARED, extraKnownMarketplaces: { other: { source: { source: 'github', repo: 'team/other' } } }, additionalMarketplaces: REGISTER } }) },
  { item: 1, name: 'another marketplace registered', setup: share({ settings: { ...SHARED, extraKnownMarketplaces: { other: { source: { source: 'github', repo: 'team/other' } } } } }) },
  { item: 1, name: 'a registration with no source', setup: share({ settings: registered(undefined) }) },
  { item: 1, name: 'the marketplace from GitHub', setup: share({ settings: registered({ source: 'github', repo: 'team/tools' }) }) },
  { item: 1, name: 'a folder with no path', setup: share({ settings: registered({ source: 'directory' }) }) },
  { item: 1, name: 'a path with backslashes', setup: share({ settings: registered({ source: 'directory', path: '.\\team-marketplace' }) }) },
  { item: 1, name: 'a path that leaves the repository', setup: share({ settings: registered({ source: 'directory', path: '../team-marketplace' }) }) },
  { item: 1, name: 'a path to another folder', setup: share({ settings: registered({ source: 'directory', path: `./${ROOT}/plugins` }) }) },
  { item: 1, name: 'the plugin under another marketplace name', setup: share({ settings: { ...SHARED, enabledPlugins: { 'team-kit@team-marketplace': true } } }) },
  { item: 1, name: 'no plugin turned on', setup: share({ settings: { ...BASE, extraKnownMarketplaces: REGISTER } }) },
  { item: 1, name: 'the plugin turned off in the shared file', setup: share({ settings: { ...SHARED, enabledPlugins: { 'team-kit@team-tools': false } } }) },

  // Item 2: a component of your own moved into the plugin.
  { item: 2, name: 'no committed plugin', setup: share({ market: {}, plugin: {}, move: [] }) },
  { item: 2, name: 'only the example components', setup: share({ move: [] }) },
  { item: 2, name: 'a skill copied, the original still committed', setup: share({ move: [], files: { [`${KIT}/skills/tdd/SKILL.md`]: START['.claude/skills/tdd/SKILL.md'] } }) },
  { item: 2, name: 'a subagent copied, the original still committed', setup: share({ move: [], files: { [`${KIT}/agents/test-gaps.md`]: START['.claude/agents/test-gaps.md'] } }) },
  { item: 2, name: 'a hook moved, still in the settings', setup: share({ move: [[HOOK_SCRIPT, `${KIT}/hooks/protect-files.sh`]], files: { [`${KIT}/hooks/hooks.json`]: json({ hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: '${CLAUDE_PLUGIN_ROOT}/hooks/protect-files.sh' }] }] } }) } }) },
  { item: 2, name: 'a hook moved that still runs the script in .claude/', setup: share({ settings: { ...SHARED, hooks: undefined }, move: [], files: { [`${KIT}/hooks/hooks.json`]: json({ hooks: HOOKS }) } }) },
  { item: 2, name: 'a trailing comma in the plugin\'s hooks file', setup: share({ move: [], files: { [`${KIT}/hooks/hooks.json`]: '{\n  "hooks": {},\n}\n' } }) },
  { item: 2, name: 'a plugin hooks file with no hook', setup: share({ move: [], files: { [`${KIT}/hooks/hooks.json`]: json({ hooks: {} }) } }) },
  { item: 2, name: 'a hook whose script is not in the plugin', setup: share({ settings: { ...SHARED, hooks: undefined }, move: [], files: { [`${KIT}/hooks/hooks.json`]: PLUGIN_HOOK('${CLAUDE_PLUGIN_ROOT}/hooks/protect-files.sh') } }) },
  { item: 2, name: 'a hook whose script is not committed', setup: share({ settings: { ...SHARED, hooks: undefined }, move: [], files: { [`${KIT}/hooks/hooks.json`]: PLUGIN_HOOK('${CLAUDE_PLUGIN_ROOT}/hooks/protect-files.sh') }, after: (dir, { write }) => write(dir, { [`${KIT}/hooks/protect-files.sh`]: '#!/bin/bash\nexit 0\n' }) }) },
  { item: 2, name: 'a moved subagent hidden by an ignore rule', setup: share({ gitignore: `${IGNORE}${KIT}/agents/test-gaps.md\n`, move: [], files: { [`${KIT}/agents/test-gaps.md`]: START['.claude/agents/test-gaps.md'], '.claude/agents/test-gaps.md': null } }) },
  { item: 2, name: 'the practice copy\'s tutor skill moved', setup: share({ move: [], files: { [`${KIT}/skills/tutor/SKILL.md`]: '---\nname: tutor\ndescription: The practice copy\'s tutor.\n---\n\nTeach.\n' } }) },
  { item: 2, name: 'a moved subagent not committed yet', setup: share({ move: [], after: (dir) => {
    execFileSync('mkdir', ['-p', join(dir, KIT, 'agents')]);
    git(dir, 'mv', '.claude/agents/test-gaps.md', `${KIT}/agents/test-gaps.md`);
  } }) },

  // Item 3: the personal files kept out of git.
  { item: 3, name: 'no ignore rule for CLAUDE.local.md', setup: share({ gitignore: '.practice/\n.claude/settings.local.json\n' }) },
  { item: 3, name: 'the local settings file tracked', setup: share({ gitignore: '.practice/\nCLAUDE.local.md\n', files: { '.claude/settings.local.json': json({ sandbox: { enabled: true } }) } }) },
  { item: 3, name: 'the local settings file removed from the index but not committed', setup: share({ gitignore: '.practice/\nCLAUDE.local.md\n', files: { '.claude/settings.local.json': json({ sandbox: { enabled: true } }) }, after: (dir) => {
    git(dir, 'rm', '-q', '--cached', '.claude/settings.local.json');
  } }) },
  { item: 3, name: 'only .git/info/exclude ignores the local settings', setup: share({ gitignore: '.practice/\nCLAUDE.local.md\n', after: (dir, { write }) => write(dir, { '.git/info/exclude': '.practice/\n.claude/settings.local.json\n' }) }) },
  { item: 3, name: 'a ! line that keeps CLAUDE.local.md', setup: share({ gitignore: `${IGNORE}!CLAUDE.local.md\n` }) },
  { item: 3, name: 'the ignore rule not committed', setup: share({ gitignore: '.practice/\nCLAUDE.local.md\n', after: (dir, { write }) => write(dir, { '.gitignore': IGNORE }) }) },
];
