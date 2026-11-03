// @ts-check
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */
import { localPath } from '../repo.mjs';
// Permissions, settings scopes and the sandbox (Intermediate, lesson 4). The
// Learner commits team permission rules in the shared .claude/settings.json,
// with an ask rule that keeps a checkpoint before a command such as a push,
// keeps personal settings in the uncommitted .claude/settings.local.json, and
// turns the sandbox on. That a sandboxed write outside the project fails shows
// only in a session, so the lesson self-checks it.
export const title = 'Permissions, settings scopes and the sandbox';

const SHARED = '.claude/settings.json';

// The local file at the git root as a path from this folder, when this
// folder sits below the root; null at the root or outside git.
/** @param {Repo} repo */
function rootLocal(repo) {
  try {
    return repo.prefix ? localPath(LOCAL, repo.prefix) : null;
  } catch {
    return null;
  }
}
const LOCAL = '.claude/settings.local.json';

/**
 * @param {string} text
 * @returns {{ value?: any, error?: string }}
 */
function parse(text) {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: /** @type {Error} */ (error).message };
  }
}

/**
 * @param {Repo} repo
 * @param {string} path
 */
function committed(repo, path) {
  try {
    return repo.git('show', `HEAD:./${path}`);
  } catch {
    return null;
  }
}

// An allow rule that lets every command, or every use of a tool, through:
// a bare tool name, `Bash(*)`, or one program with any arguments.
/** @param {string} rule */
function broad(rule) {
  const m = rule.match(/^(\w+)(?:\((.*)\))?$/);
  if (!m) return false;
  const [, tool, spec] = m;
  if (spec === undefined || spec === '*' || spec === '**') return true;
  return tool === 'Bash' && /^\S+(\s+\*|:\*)$/.test(spec.trim());
}

const READ_ENV = /^Read\((\.\/|\/|\*\*\/)?\.env\)$/;
const READ_ENV_ANY = /^Read\((\.\/|\/|\*\*\/)?\.env\.\*\)$/;

/** @type {Item[]} */
export const items = [
  {
    text: 'the committed `.claude/settings.json` denies reading `.env` files and allows a narrow test command',
    check(repo) {
      const text = committed(repo, SHARED);
      if (text === null) return repo.exists(SHARED) ? `${SHARED} is not committed. Run \`git add ${SHARED}\` and commit it: team rules belong in the shared file.` : `There is no ${SHARED}. Save the partial file from the lesson's Your turn there.`;
      const { value, error } = parse(text);
      if (error) return `The committed ${SHARED} is not valid JSON: ${error}`;
      const allow = value?.permissions?.allow ?? [];
      const deny = value?.permissions?.deny ?? [];
      const todo = [...allow, ...deny].filter((r) => /TODO/.test(r));
      if (todo.length) return `Replace each TODO with a rule: ${todo.join('; ')}.`;
      if (!deny.some((/** @type {string} */ r) => READ_ENV.test(r))) return 'Add `Read(./.env)` to `permissions.deny`.';
      if (!deny.some((/** @type {string} */ r) => READ_ENV_ANY.test(r))) return 'Add `Read(./.env.*)` to `permissions.deny`, for .env.local and the other .env.* files.';
      const wide = allow.filter(broad);
      if (wide.length) return `${wide.join(', ')} lets every command or every use of a tool through. Allow one command, such as \`Bash(npm test)\`.`;
      if (!allow.some((/** @type {string} */ r) => /^Bash\(.+\)$/.test(r))) return 'Add an allow rule for the command that runs your tests, such as `Bash(npm test)`.';
      return true;
    },
  },
  {
    text: 'the sandbox is on, and `.claude/settings.local.json` stays out of git',
    // `/sandbox` saves to the uncommitted local file, which never reaches CI.
    // Claude Code keeps that file at the git root, which in a Practice copy
    // is the folder above project/; one in project/ counts too (ticket 295).
    local: true,
    check(repo) {
      const tracked = repo.trackedAny(LOCAL);
      if (tracked) return `${tracked} is committed, but it holds your own settings. Run \`git rm --cached ${tracked}\`, commit, and add it to \`.gitignore\`.`;
      // The root's local file wins key by key over one in project/, so a key
      // either lacks falls through to the next file.
      const atRoot = rootLocal(repo);
      for (const path of [...(atRoot ? [atRoot] : []), LOCAL, SHARED]) {
        const text = repo.read(path);
        if (text === null) continue;
        const { value, error } = parse(text);
        if (error) return `${path} is not valid JSON: ${error}`;
        // Local Boolean values override shared settings, including false.
        if (value?.sandbox?.enabled === false) break;
        if (value?.sandbox?.enabled === true) return true;
      }
      return 'The sandbox is off. Run `/sandbox` in a session and choose the auto-allow mode, which saves `"sandbox": {"enabled": true}` to .claude/settings.local.json at the repository root: in a Practice copy, the folder above project/. Either place counts.';
    },
  },
  {
    text: 'the committed `.claude/settings.json` asks before a command the team approves each time, such as `git push`',
    check(repo) {
      const { value } = parse(committed(repo, SHARED) ?? '');
      if (!value) return `Commit ${SHARED} as valid JSON, with the ask rule in \`permissions.ask\`.`;
      const ask = value?.permissions?.ask ?? [];
      if (ask.some((/** @type {string} */ r) => /TODO/.test(r))) return 'Replace the TODO in `permissions.ask` with a rule, such as `Bash(git push *)`, and commit again.';
      return ask.some((/** @type {string} */ r) => /^Bash\(.+\)$/.test(r)) ? true : 'Add an ask rule to `permissions.ask`, such as `Bash(git push *)`, so Claude Code prompts before a `git push`, even in auto mode.';
    },
  },
];
