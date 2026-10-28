// Permissions, settings scopes and the sandbox (Intermediate, lesson 4). The
// Learner commits team permission rules in the shared .claude/settings.json,
// with an ask rule that keeps a checkpoint before a command such as a push,
// keeps personal settings in the uncommitted .claude/settings.local.json, and
// turns the sandbox on. That a sandboxed write outside the project fails shows
// only in a session, so the lesson self-checks it.
export const title = 'Permissions, settings scopes and the sandbox';

const SHARED = '.claude/settings.json';
const LOCAL = '.claude/settings.local.json';

function parse(text) {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: error.message };
  }
}

function committed(repo, path) {
  try {
    return repo.git('show', `HEAD:${path}`);
  } catch {
    return null;
  }
}

// An allow rule that lets every command, or every use of a tool, through:
// a bare tool name, `Bash(*)`, or one program with any arguments.
function broad(rule) {
  const m = rule.match(/^(\w+)(?:\((.*)\))?$/);
  if (!m) return false;
  const [, tool, spec] = m;
  if (spec === undefined || spec === '*' || spec === '**') return true;
  return tool === 'Bash' && /^\S+(\s+\*|:\*)$/.test(spec.trim());
}

const READ_ENV = /^Read\((\.\/|\/|\*\*\/)?\.env\)$/;
const READ_ENV_ANY = /^Read\((\.\/|\/|\*\*\/)?\.env\.\*\)$/;

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
      if (!deny.some((r) => READ_ENV.test(r))) return 'Add `Read(./.env)` to `permissions.deny`.';
      if (!deny.some((r) => READ_ENV_ANY.test(r))) return 'Add `Read(./.env.*)` to `permissions.deny`, for .env.local and the other .env.* files.';
      const wide = allow.filter(broad);
      if (wide.length) return `${wide.join(', ')} lets every command or every use of a tool through. Allow one command, such as \`Bash(npm test)\`.`;
      if (!allow.some((r) => /^Bash\(.+\)$/.test(r))) return 'Add an allow rule for the command that runs your tests, such as `Bash(npm test)`.';
      return true;
    },
  },
  {
    text: 'the sandbox is on, and `.claude/settings.local.json` stays out of git',
    // `/sandbox` saves to the uncommitted local file, which never reaches CI.
    local: true,
    check(repo) {
      if (repo.git('ls-files', '--', LOCAL)) return `${LOCAL} is committed, but it holds your own settings. Run \`git rm --cached ${LOCAL}\`, commit, and add it to \`.gitignore\`.`;
      for (const path of [LOCAL, SHARED]) {
        const text = repo.read(path);
        if (text === null) continue;
        const { value, error } = parse(text);
        if (error) return `${path} is not valid JSON: ${error}`;
        // Local Boolean values override shared settings, including false.
        if (value?.sandbox?.enabled === false) break;
        if (value?.sandbox?.enabled === true) return true;
      }
      return 'The sandbox is off. Run `/sandbox` in a session and choose the auto-allow mode, which saves `"sandbox": {"enabled": true}` to .claude/settings.local.json.';
    },
  },
  {
    text: 'the committed `.claude/settings.json` asks before a command the team approves each time, such as `git push`',
    check(repo) {
      const { value } = parse(committed(repo, SHARED) ?? '');
      if (!value) return `Commit ${SHARED} as valid JSON, with the ask rule in \`permissions.ask\`.`;
      const ask = value?.permissions?.ask ?? [];
      if (ask.some((r) => /TODO/.test(r))) return 'Replace the TODO in `permissions.ask` with a rule, such as `Bash(git push *)`, and commit again.';
      return ask.some((r) => /^Bash\(.+\)$/.test(r)) ? true : 'Add an ask rule to `permissions.ask`, such as `Bash(git push *)`, so Claude Code prompts before a `git push`, even in auto mode.';
    },
  },
];
