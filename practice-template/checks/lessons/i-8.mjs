// @ts-check
// Install and manage plugins (Intermediate, lesson 8). The Learner installs a
// language server, then trials its code intelligence plugin at local scope
// (the code intelligence page's order: the binary, the plugin, then a check
// that the server starts), enables a plugin from one of
// Anthropic's marketplaces for the whole project, in the committed
// .claude/settings.json, installs it at project scope, and saves
// `claude plugin list --json` so the check can see both installs.
import { realpathSync } from 'node:fs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Install and manage plugins';

const ANTHROPIC = ['claude-plugins-official', 'claude-community', 'claude-code-plugins'];
const SAVE = '`claude plugin list --json > .practice/i-8-plugins.json`';

// Whether an install's projectPath is this repository: true or false when the
// path exists on this machine, null when it doesn't (a list saved elsewhere).
/**
 * @param {string} projectPath
 * @param {string} dir
 */
function here(projectPath, dir) {
  try {
    return realpathSync(projectPath) === realpathSync(dir);
  } catch {
    return null;
  }
}

// The plugins the committed settings turn on, every marketplace's, or null
// when there is no committed settings file that parses.
/** @param {Repo} repo */
function committedPlugins(repo) {
  try {
    const value = JSON.parse(repo.git('show', 'HEAD:./.claude/settings.json'));
    return Object.entries(value?.enabledPlugins ?? {}).filter(([, on]) => on === true).map(([id]) => id);
  } catch {
    return null;
  }
}

/** @param {Repo} repo */
function projectPlugins(repo) {
  return committedPlugins(repo)?.filter((id) => ANTHROPIC.includes(/** @type {string} */ (id.split('@')[1]))) ?? null;
}

// The saved plugin list's installs, or a FAIL message.
/**
 * @param {Repo} repo
 * @returns {any[] | string}
 */
function savedList(repo) {
  const text = repo.read('.practice/i-8-plugins.json');
  if (text === null) return `In the repository, run ${SAVE}.`;
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : list?.installed ?? [];
  } catch {
    return `.practice/i-8-plugins.json isn't JSON. Run ${SAVE} again, from the repository's root.`;
  }
}

/** @type {Item[]} */
export const items = [
  {
    text: 'the committed `.claude/settings.json` enables a plugin from one of Anthropic\'s marketplaces',
    check(repo) {
      const ids = projectPlugins(repo);
      if (ids === null) return 'There is no committed .claude/settings.json that parses as JSON. Add the `enabledPlugins` entry from the lesson and commit it.';
      return ids.length ? true : `Its \`enabledPlugins\` turns on no plugin from Anthropic's marketplaces. Add \`"claude-code-setup@claude-plugins-official": true\`: the part after @ is the marketplace's name, one of ${ANTHROPIC.join(', ')}.`;
    },
  },
  {
    text: '`.practice/i-8-plugins.json`, saved in this repository, shows that plugin installed at project scope and enabled',
    local: true,
    check(repo) {
      const list = savedList(repo);
      if (typeof list === 'string') return list;
      const ids = projectPlugins(repo) ?? [];
      // The list holds project-scope installs for every project on the machine,
      // and projectEnabled reflects the settings of the folder it ran in, so an
      // install counts only when its projectPath is this repository.
      const ok = list.some((p) => ids.includes(p?.id) && p.scope === 'project' && p.enabled === true && p.projectEnabled === true && here(p.projectPath, repo.dir) !== false);
      return ok ? true : `The saved list doesn't show the plugin at project scope here. Install it with \`--scope project\`, then save the list again.`;
    },
  },
  {
    text: 'a code intelligence plugin you trialled is installed at local scope here, and the committed settings leave it off',
    local: true,
    check(repo) {
      const list = savedList(repo);
      if (typeof list === 'string') return list;
      const trials = list.filter((p) => /-lsp@/.test(p?.id ?? '') && p.scope === 'local' && here(p.projectPath, repo.dir) !== false);
      if (!trials.length) return 'The saved list shows no code intelligence plugin at local scope here. Install your language\'s plugin, such as `typescript-lsp`, for this repository only, then save the list again.';
      const shared = trials.map((p) => p.id).filter((id) => (committedPlugins(repo) ?? []).includes(id));
      return shared.length < trials.length ? true : `${shared.join(', ')} is turned on in the committed \`.claude/settings.json\`, so every teammate gets your trial. Take it out of \`enabledPlugins\` and commit.`;
    },
  },
];
