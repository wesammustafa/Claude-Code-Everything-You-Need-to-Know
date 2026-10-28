// One `claude` command line, read the way Claude Code v2.1.285 reads it
// (with the commander library): `--flag value` and `--flag=value`; short
// flags that combine, as in `-cp`; a flag whose value is optional takes the
// next argument only when it isn't an option; a flag that takes a list keeps
// taking arguments until the next option, so a prompt written after
// `--allowedTools Read` becomes a tool name. Shared by the Advanced checks
// that run a script with a stand-in for `claude`. When a script never
// reaches its `claude` call under the stand-in, `scriptCalls` reads the
// call's arguments from the script's text instead.

// The options `claude --help` lists at v2.1.285, and the documented ones it
// leaves out, written as --help writes them: `<value>`, `[optional value]`
// or `<list...>`.
const SPEC = [
  '--add-dir <directories...>',
  '--advisor <model>',
  '--agent <agent>',
  '--agents <json-or-file>',
  '--allow-dangerously-skip-permissions',
  '--allowedTools, --allowed-tools <tools...>',
  '--append-subagent-system-prompt <prompt>',
  '--append-subagent-system-prompt-file <file>',
  '--append-system-prompt <prompt>',
  '--append-system-prompt-file <file>',
  '--autocompact <auto|tokens>',
  '--ax-screen-reader',
  '--bg, --background',
  '--bare',
  '--betas <betas...>',
  '--brief',
  '--channels <servers...>',
  '--chrome',
  '--client-data-url <url>',
  '--cloud [description|session_id|url]',
  '-c, --continue',
  '--dangerously-load-development-channels <servers...>',
  '--dangerously-skip-permissions',
  '-d, --debug [filter]',
  '--debug-file <path>',
  '--desktop',
  '--disable-slash-commands',
  '--disallowedTools, --disallowed-tools <tools...>',
  '--effort <level>',
  '--environment <environment_id>',
  '--exclude-dynamic-system-prompt-sections',
  '--fallback-model <model>',
  '--file <specs...>',
  '--fork-session',
  '--forward-subagent-text',
  '--from-pr [value]',
  '-h, --help',
  '--ide',
  '--include-hook-events',
  '--include-partial-messages',
  '--init',
  '--init-only',
  '--input-format <format>',
  '--json-schema <schema>',
  '--maintenance',
  '--max-budget-usd <amount>',
  '--max-turns <turns>',
  '--mcp-config <configs...>',
  '--model <model>',
  '-n, --name <name>',
  '--no-chrome',
  '--no-session-persistence',
  '--output-format <format>',
  '--permission-mode <mode>',
  '--permission-prompt-tool <tool>',
  '--permission-prompts <target>',
  '--plugin-dir <path>',
  '--plugin-url <url>',
  '-p, --print',
  '--prompt-suggestions [value]',
  '--rc [name]',
  '--ref <ref>',
  '--remote [description|session_id|url]',
  '--remote-control [name]',
  '--remote-control-session-name-prefix <prefix>',
  '--replay-user-messages',
  '--restricted',
  '-r, --resume [value]',
  '--safe-mode',
  '--session-id <uuid>',
  '--setting-sources <sources>',
  '--settings <file-or-json>',
  '--strict-mcp-config',
  '--system-prompt <prompt>',
  '--system-prompt-file <file>',
  '--system-prompt-snapshot <on|off>',
  '--teammate-mode <mode>',
  '--teleport [session]',
  '--tmux',
  '--tools <tools...>',
  '--verbose',
  '-v, --version',
  '-w, --worktree [name]',
];

const camel = (flag) => flag.replace(/^-+/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase());

// Each flag, short and long, to `{ name, kind }`: kind is 'flag', 'value',
// 'optional' or 'list'; name is the first long flag in camelCase, as in
// `allowedTools` for both `--allowedTools` and `--allowed-tools`.
const OPTIONS = new Map();
for (const line of SPEC) {
  const [, flags, open, list] = line.match(/^(.*?)(?: ([<[])[^>\]]*?(\.\.\.)?[>\]])?$/);
  const names = flags.split(', ');
  const kind = !open ? 'flag' : open === '[' ? 'optional' : list ? 'list' : 'value';
  const option = { name: camel(names.find((n) => n.startsWith('--'))), kind };
  for (const n of names) OPTIONS.set(n, option);
}

const optionLike = (arg) => arg.length > 1 && arg[0] === '-';

// Reads one argv (without `claude` itself). Returns `{ print, promptFirst,
// next, prompt, operands, flags, unknown }`: `print` when `-p` or `--print`
// is there; `next`, what comes right after the first one; `promptFirst`
// when that is the prompt; `prompt`, the first argument that is neither an
// option nor a value; `flags`, by name, `true` for a flag (or an optional
// value left out), a string for a value (null when it's missing; the last
// one wins) and an array for a list (repeats add up); `unknown`, options
// Claude Code doesn't know, which make it stop with an error before the run.
export function parseClaudeArgs(argv) {
  const flags = {};
  const operands = [];
  const unknown = [];
  // `rest` marks what is left of a token after a combined short flag.
  const queue = argv.map((text, at) => ({ text, at }));
  let list = null;
  let print = null;
  const set = (option, value) => {
    if (option.kind === 'list') flags[option.name] = [...(flags[option.name] ?? []), value];
    else flags[option.name] = value;
  };
  // Where the prompt must be when -p ends its token, or what follows it in
  // the same token, as in `-pc`.
  const printed = (item, rest) => {
    if (print) return;
    print = rest ? { next: `-${rest}` } : { at: item.at + 1, next: argv[item.at + 1] };
  };
  while (queue.length) {
    const item = queue.shift();
    const arg = item.text;
    if (arg === '--' && !item.rest) {
      operands.push(...queue);
      break;
    }
    if (list && !optionLike(arg)) {
      set(list, arg);
      continue;
    }
    list = null;
    const option = optionLike(arg) ? OPTIONS.get(arg) : undefined;
    if (option) {
      if (option.kind === 'flag') {
        set(option, true);
        if (option.name === 'print') printed(item);
      } else if (option.kind === 'optional') {
        set(option, queue.length && !optionLike(queue[0].text) ? queue.shift().text : true);
      } else {
        set(option, queue.length ? queue.shift().text : null);
        if (option.kind === 'list') list = option;
      }
      continue;
    }
    const short = arg.length > 2 && arg[0] === '-' && arg[1] !== '-' && OPTIONS.get(`-${arg[1]}`);
    if (short) {
      if (short.kind === 'flag') {
        set(short, true);
        if (short.name === 'print') printed(item, arg.slice(2));
        queue.unshift({ text: `-${arg.slice(2)}`, at: item.at, rest: true });
      } else {
        set(short, arg.slice(2));
      }
      continue;
    }
    const assigned = arg.match(/^(--[^=]+)=([\s\S]*)$/);
    const long = assigned && OPTIONS.get(assigned[1]);
    if (long && long.kind !== 'flag') {
      set(long, assigned[2]);
      continue;
    }
    if (optionLike(arg)) unknown.push(arg);
    else operands.push(item);
  }
  return {
    print: Boolean(print),
    promptFirst: Boolean(print?.at !== undefined && operands[0]?.at === print.at),
    next: print?.next,
    prompt: operands[0]?.text,
    operands: operands.map((o) => o.text),
    flags,
    unknown,
  };
}

// The entries of a tool list, such as `--allowedTools` values: split on
// commas and spaces, except inside parentheses, so `Bash(git diff *)` stays
// one entry.
export function ruleList(values) {
  const entries = [];
  for (const value of values ?? []) {
    let depth = 0;
    let current = '';
    for (const ch of String(value)) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
        if (current) entries.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current) entries.push(current);
  }
  return entries;
}

// The `claude` commands in a shell script, read without running it: each
// command's arguments, in order. Backslash line ends join lines, comments
// go and quotes come off. `$NAME` and `${NAME}` take the value of a plain
// assignment earlier in the script, split into words when unquoted, and
// `${NAME:-default}` takes its default when the script never sets NAME.
// Anything else, such as `$1` or `$(command)`, stays as written. Commands
// inside `$(...)` and backticks count too, and a here-document's text is
// skipped. A command that runs Claude Code by its path, such as
// `~/.local/bin/claude`, counts as a `claude` command.
export function scriptCalls(text) {
  const calls = [];
  scan(String(text ?? '').replace(/\r\n?/g, '\n'), new Map(), calls);
  return calls;
}

// Words that can come before a command's name.
const LEADING = new Set(['if', 'then', 'elif', 'else', 'do', 'while', 'until', '!', '{', 'exec', 'command', 'builtin', 'time', 'nohup']);
const DECLARE = new Set(['export', 'readonly', 'local', 'declare', 'typeset']);
const ASSIGNMENT = /^([A-Za-z_]\w*)=([\s\S]*)$/;
const NAME = /^[A-Za-z_]\w*/;

// The index just past the `close` that matches the `open` at `start`,
// skipping quoted text; the end of `src` when there is none.
function matching(src, start, open, close) {
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (c === '\\') i += 1;
    else if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      i = end === -1 ? src.length : end;
    } else if (c === open) depth += 1;
    else if (c === close && (depth -= 1) === 0) return i + 1;
  }
  return src.length;
}

function scan(src, vars, calls) {
  let words = [];
  let word = null;
  let target = false;
  let heredocs = [];
  const end = () => {
    if (word !== null) {
      if (target) target = false;
      else words.push(word);
    }
    word = null;
  };
  const add = (value, quoted) => {
    if (quoted || !/\s/.test(value)) {
      word = (word ?? '') + value;
      return;
    }
    // An unquoted value with spaces becomes several words.
    value.split(/(\s+)/).forEach((part) => {
      if (/^\s+$/.test(part)) end();
      else if (part) word = (word ?? '') + part;
    });
  };
  const finish = () => {
    end();
    let k = 0;
    const assigned = [];
    while (k < words.length) {
      if (LEADING.has(words[k])) k += 1;
      else if (DECLARE.has(words[k])) {
        k += 1;
        while (k < words.length && words[k].startsWith('-')) k += 1;
      } else if (ASSIGNMENT.test(words[k])) {
        assigned.push(words[k].match(ASSIGNMENT));
        k += 1;
      } else break;
    }
    if (k === words.length) for (const [, name, value] of assigned) vars.set(name, value);
    if (words[k] === 'env') {
      k += 1;
      while (k < words.length && (words[k].startsWith('-') || ASSIGNMENT.test(words[k]))) k += 1;
    }
    if (k < words.length && /(^|\/)claude$/.test(words[k])) calls.push(words.slice(k + 1));
    words = [];
  };
  // Reads a `$` expansion at `i` and returns the index after it.
  const expand = (i, quoted) => {
    const next = src[i + 1];
    if (next === '(') {
      const stop = matching(src, i + 1, '(', ')');
      // `$((...))` is arithmetic, not a command.
      if (src[i + 2] !== '(') scan(src.slice(i + 2, stop - 1), new Map(vars), calls);
      add(src.slice(i, stop), true);
      return stop;
    }
    // `$'...'` quotes like '...'.
    if (next === "'" && !quoted) return i + 1;
    if (next === '{') {
      const stop = matching(src, i + 1, '{', '}');
      const inner = src.slice(i + 2, stop - 1);
      const m = inner.match(/^([A-Za-z_]\w*)(?:(:?[-=])([\s\S]*))?$/);
      if (m && vars.has(m[1])) add(vars.get(m[1]), quoted);
      else if (m && m[2]) add(m[3], quoted);
      else add(src.slice(i, stop), true);
      return stop;
    }
    const name = src.slice(i + 1).match(NAME)?.[0];
    if (name) {
      add(vars.has(name) ? vars.get(name) : `$${name}`, vars.has(name) ? quoted : true);
      return i + 1 + name.length;
    }
    if (next && /[\d@*#?$!-]/.test(next)) {
      add(`$${next}`, true);
      return i + 2;
    }
    add('$', true);
    return i + 1;
  };
  // Reads a backtick command at `i` and returns the index after it.
  const backtick = (i) => {
    const close = src.indexOf('`', i + 1);
    const stop = close === -1 ? src.length : close + 1;
    scan(src.slice(i + 1, close === -1 ? src.length : close), new Map(vars), calls);
    add(src.slice(i, stop), true);
    return stop;
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      if (src[i + 1] !== '\n') add(src[i + 1] ?? '', true);
      i += 2;
    } else if (c === "'") {
      const stop = src.indexOf("'", i + 1);
      add(src.slice(i + 1, stop === -1 ? src.length : stop), true);
      i = stop === -1 ? src.length : stop + 1;
    } else if (c === '"') {
      word ??= '';
      i += 1;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && /["\\$`\n]/.test(src[i + 1] ?? '')) {
          if (src[i + 1] !== '\n') add(src[i + 1], true);
          i += 2;
        } else if (src[i] === '$') i = expand(i, true);
        else if (src[i] === '`') i = backtick(i);
        else {
          add(src[i], true);
          i += 1;
        }
      }
      i += 1;
    } else if (c === '$') {
      i = expand(i, false);
    } else if (c === '`') {
      i = backtick(i);
    } else if (c === '#' && word === null) {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (c === '>' || c === '<' || (c === '&' && src[i + 1] === '>')) {
      // A file descriptor written right before the operator, as in 2>, isn't a word.
      if (word !== null && /^\d+$/.test(word)) word = null;
      end();
      if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
        const m = src.slice(i).match(/^<<-?\s*(['"]?)([^\s'";|&<>()]+)\1/);
        if (m) {
          heredocs.push(m[2]);
          i += m[0].length;
          continue;
        }
      }
      i += c === '&' ? 2 : 1;
      if (src[i] === '>' || src[i] === '|' || src[i] === '<') i += 1;
      if (src[i] === '&') {
        i += 1;
        while (/[\d-]/.test(src[i] ?? '')) i += 1;
      } else target = true;
    } else if (c === '\n' || c === ';' || c === '&' || c === '|' || c === '(' || c === ')') {
      finish();
      if ((c === '&' || c === '|') && src[i + 1] === c) i += 1;
      i += 1;
      // A here-document's text starts on the line after its operator.
      if (c === '\n' && heredocs.length) {
        for (const delimiter of heredocs) {
          while (i < src.length) {
            const stop = src.indexOf('\n', i);
            const line = src.slice(i, stop === -1 ? src.length : stop);
            i = stop === -1 ? src.length : stop + 1;
            if (line.replace(/^\t+/, '') === delimiter) break;
          }
        }
        heredocs = [];
      }
    } else if (/\s/.test(c)) {
      end();
      i += 1;
    } else {
      add(c, true);
      i += 1;
    }
  }
  finish();
}
