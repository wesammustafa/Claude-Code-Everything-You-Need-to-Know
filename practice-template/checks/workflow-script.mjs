// Workflow-script helpers shared by Advanced lesson 3's check and the Advanced
// capstone: the saved workflows a repository keeps in .claude/workflows/,
// read the way Claude Code loads them, without running them. The meta block
// is a literal object as the first statement, the body compiles, and the
// names the code uses are found with comments and strings left out.
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';

// A saved workflow: a .js file directly in a .claude/workflows/ folder, at
// the repository's root or in a package's own .claude/ folder.
export const WORKFLOW = /(^|\/)\.claude\/workflows\/[^/]+\.js$/;
const IN_WORKFLOWS = /(^|\/)\.claude\/workflows\//;
const SCRIPT_LIKE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
// The Advanced checks never scan worktrees, dependencies, or the template's
// own checks and capstone briefs.
const SKIPPED = /^(?:checks|capstone)\/|(?:^|\/)(?:node_modules|\.claude\/worktrees)\//;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const paths = (run) => {
  try {
    return run().split('\0').filter(Boolean);
  } catch {
    return [];
  }
};

// The ignore rule that hides `path`, as git reports it with the Learner's own
// configuration, global excludes file included, or null.
function ignoreRule(repo, path) {
  try {
    const out = execFileSync('git', ['check-ignore', '--stdin', '-z', '-v', '--no-index'], { cwd: repo.dir, input: `${path}\0`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const [source, line, pattern] = out.split('\0');
    return source ? { source, line: Number(line), pattern } : null;
  } catch {
    return null;
  }
}

function changedSinceHead(repo, path) {
  try {
    repo.git('diff', '--quiet', 'HEAD', '--', path);
    return false;
  } catch {
    return true;
  }
}

// The workflow scripts in the repository: `scripts`, committed at HEAD, each
// `{ path, text, changed }`, where `changed` means the working copy differs;
// `misplaced`, committed script files under a .claude/workflows/ folder that
// aren't a .js file directly in it; and `uncommitted`, scripts only in the
// working tree or the index, each `{ path, rule }`, with the ignore rule
// that hides it, if any.
export function findWorkflows(repo) {
  const committed = paths(() => repo.git('ls-tree', '-r', '-z', '--name-only', 'HEAD'))
    .filter((p) => IN_WORKFLOWS.test(p) && !SKIPPED.test(p));
  const scripts = committed.filter((p) => WORKFLOW.test(p)).map((path) => ({
    path,
    text: repo.git('show', `HEAD:${path}`),
    changed: changedSinceHead(repo, path),
  }));
  const misplaced = committed.filter((p) => !WORKFLOW.test(p) && SCRIPT_LIKE.test(p));
  const spec = ':(glob)**/.claude/workflows/*.js';
  const ignored = new Set(paths(() => repo.git('ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', spec)));
  const listed = paths(() => repo.git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', spec));
  const uncommitted = [...new Set([...listed, ...ignored])]
    .filter((p) => WORKFLOW.test(p) && !SKIPPED.test(p) && !committed.includes(p))
    .sort()
    .map((path) => ({ path, rule: ignored.has(path) ? ignoreRule(repo, path) : null }));
  return { scripts, misplaced, uncommitted };
}

// A JavaScript tokenizer, good enough for code that compiles: it skips
// comments and whitespace and returns names, punctuators, numbers, strings,
// template parts and regular expressions, each `{ type, value, start, end,
// line }`. A template part has `subst: true` when a `${` follows it. It never
// throws: an unterminated string or comment runs to the end of the text.
const NAME = /[A-Za-z_$\u00a0-\uffff][\w$\u00a0-\uffff]*/y;
const NUMBER = /(?:0[xXoObB][\da-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/y;
const PUNCT = /\.\.\.|\?\?=|\?\.(?!\d)|=>|[=!]==?|\*\*=?|<<=?|>>>?=?|&&=?|\|\|=?|\?\?|\+\+|--|[-+*%&|^<>]=?|[~?:;,.()[\]{}@#]/y;
// After these, a slash starts a regular expression rather than a division.
const BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };

export function tokenize(source) {
  const tokens = [];
  const newlines = [];
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) newlines.push(i);
  const lineAt = (pos) => {
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlines[mid] < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  const n = source.length;
  const stack = [];
  let i = 0;
  const push = (type, start, value, extra = {}) => tokens.push({ type, value, start, end: i, line: lineAt(start), ...extra });
  const sticky = (pattern) => {
    pattern.lastIndex = i;
    const m = pattern.exec(source);
    return m ? m[0] : null;
  };
  // The cooked text of a quoted string or template part, up to `close`.
  const quoted = (close) => {
    let text = '';
    while (i < n) {
      const c = source[i];
      if (c === '\\') {
        const e = source[i + 1] ?? '';
        if (e === 'u' || e === 'x') {
          const hex = e === 'x' ? source.slice(i + 2, i + 4) : source[i + 2] === '{' ? source.slice(i + 3, source.indexOf('}', i)) : source.slice(i + 2, i + 6);
          const code = Number.parseInt(hex, 16);
          text += Number.isNaN(code) || code > 0x10ffff ? e : String.fromCodePoint(code);
          i += e === 'x' ? 4 : source[i + 2] === '{' ? hex.length + 4 : 6;
          continue;
        }
        // A backslash before a line break continues the line.
        const crlf = e === '\r' && source[i + 2] === '\n';
        text += e === '\n' || crlf ? '' : (ESCAPES[e] ?? e);
        i += crlf ? 3 : 2;
        continue;
      }
      if (close === '`' && c === '$' && source[i + 1] === '{') {
        i += 2;
        return { text, open: true };
      }
      if (c === close || (close !== '`' && c === '\n')) {
        i += c === close ? 1 : 0;
        return { text, open: false };
      }
      text += c;
      i += 1;
    }
    return { text, open: false };
  };
  const template = (start) => {
    const { text, open } = quoted('`');
    push('template', start, text, { subst: open });
    if (open) stack.push('`');
  };

  while (i < n) {
    const c = source[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    const start = i;
    if (c === '"' || c === "'") {
      i += 1;
      push('string', start, quoted(c).text);
      continue;
    }
    if (c === '`') {
      i += 1;
      template(start);
      continue;
    }
    if (c === '}' && stack.at(-1) === '`') {
      stack.pop();
      i += 1;
      template(start);
      continue;
    }
    if (c === '/') {
      const prev = tokens.at(-1);
      const regex = !prev || (prev.type === 'punct' && !/^[)\]}]$/.test(prev.value)) || (prev.type === 'name' && BEFORE_REGEX.has(prev.value));
      if (regex) {
        i += 1;
        let inClass = false;
        while (i < n && source[i] !== '\n') {
          const ch = source[i];
          i += ch === '\\' ? 2 : 1;
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) break;
        }
        i += sticky(/[A-Za-z]*/y).length;
        push('regex', start, source.slice(start, i));
        continue;
      }
      i += source[i + 1] === '=' ? 2 : 1;
      push('punct', start, source.slice(start, i));
      continue;
    }
    const number = /\d/.test(c) || (c === '.' && /\d/.test(source[i + 1] ?? '')) ? sticky(NUMBER) : null;
    if (number) {
      i += number.length;
      push('number', start, number);
      continue;
    }
    const name = sticky(NAME);
    if (name) {
      i += name.length;
      push('name', start, name);
      continue;
    }
    const punct = sticky(PUNCT) ?? c;
    i += punct.length;
    if (punct === '{') stack.push('{');
    else if (punct === '}') stack.pop();
    push('punct', start, punct);
  }
  return tokens;
}

const is = (token, value) => token?.type === 'punct' && token.value === value;
const LITERAL_NAMES = { true: true, false: false, null: null };

// A name, or a member chain such as `Date.now`, starting at tokens[j]: its
// text and the index after it.
function chain(tokens, j) {
  let k = j + 1;
  while ((is(tokens[k], '.') || is(tokens[k], '?.')) && tokens[k + 1]?.type === 'name') k += 2;
  return [tokens.slice(j, k).map((t) => t.value).join(''), k];
}

// The object literal that starts at tokens[j], as a value, when it holds only
// literal values; otherwise it throws `{ what, line }`, naming the first thing
// that isn't one.
function literalObject(tokens, j) {
  const fail = (what, token) => {
    throw { what, line: (token ?? tokens.at(-1))?.line ?? 1 };
  };
  function value(k) {
    const t = tokens[k];
    if (!t) fail('nothing', t);
    if (t.type === 'string') return [k + 1, t.value];
    if (t.type === 'number') return [k + 1, Number(t.value.replace(/_/g, '').replace(/n$/, ''))];
    if (t.type === 'template') {
      if (t.subst) fail('a template string with `${...}`', t);
      return [k + 1, t.value];
    }
    if ((is(t, '-') || is(t, '+')) && tokens[k + 1]?.type === 'number') {
      const [next, number] = value(k + 1);
      return [next, t.value === '-' ? -number : number];
    }
    if (t.type === 'name') {
      if (t.value in LITERAL_NAMES) return [k + 1, LITERAL_NAMES[t.value]];
      if (['function', 'async', 'class'].includes(t.value) || is(tokens[k + 1], '=>')) fail('a function', t);
      const [text, after] = chain(tokens, k);
      if (is(tokens[after], '(')) fail(`a function call, \`${text}(...)\``, t);
      fail(`a variable, \`${text}\``, t);
    }
    if (is(t, '{')) return object(k);
    if (is(t, '[')) return array(k);
    if (is(t, '...')) fail('a spread, `...`', t);
    if (is(t, '(')) {
      // `(x) => ...` is a function; anything else in parentheses is an expression.
      let depth = 0;
      let close = k;
      for (; close < tokens.length; close += 1) {
        if (is(tokens[close], '(')) depth += 1;
        else if (is(tokens[close], ')') && --depth === 0) break;
      }
      fail(is(tokens[close + 1], '=>') ? 'a function' : 'an expression in parentheses', t);
    }
    return fail(`an expression, \`${t.value}\``, t);
  }
  // After a value, a comma or the closing bracket must follow.
  function separator(k, close) {
    const t = tokens[k];
    if (is(t, ',')) return [k + 1, false];
    if (is(t, close)) return [k + 1, true];
    if (t && (is(t, '(') || is(t, '.') || is(t, '?.'))) fail('a function call or a property of a value', t);
    return fail(t ? `an expression, \`${t.value}\`` : 'nothing', t);
  }
  function array(k) {
    const list = [];
    let at = k + 1;
    while (!is(tokens[at], ']')) {
      if (is(tokens[at], '...')) fail('a spread, `...`', tokens[at]);
      const [next, item] = value(at);
      list.push(item);
      const [after, done] = separator(next, ']');
      if (done) return [after, list];
      at = after;
    }
    return [at + 1, list];
  }
  function object(k) {
    const fields = {};
    let at = k + 1;
    while (!is(tokens[at], '}')) {
      const t = tokens[at];
      if (!t) fail('nothing', t);
      if (is(t, '...')) fail('a spread, `...`', t);
      if (is(t, '[')) fail('a computed key, `[...]`', t);
      if (!['name', 'string', 'number'].includes(t.type)) fail(`an expression, \`${t.value}\``, t);
      if (t.type === 'name' && ['get', 'set', 'async'].includes(t.value) && tokens[at + 1]?.type === 'name') fail('a function', t);
      const after = tokens[at + 1];
      if (is(after, '(')) fail(`a function, \`${t.value}()\``, t);
      if (is(after, ',') || is(after, '}')) fail(`a variable, \`${t.value}\``, t);
      if (!is(after, ':')) fail(after ? `an expression, \`${after.value}\`` : 'nothing', after);
      const [next, item] = value(at + 2);
      fields[t.value] = item;
      const [rest, done] = separator(next, '}');
      if (done) return [rest, fields];
      at = rest;
    }
    return [at + 1, fields];
  }
  return object(j)[1];
}

// Whether the name token at tokens[k] reads a variable of that name: not a
// property (`x.args`), an object key (`{ args: 1 }`) or a declaration.
function reads(tokens, k) {
  const prev = tokens[k - 1];
  const next = tokens[k + 1];
  if (is(prev, '.') || is(prev, '?.')) return false;
  if (is(next, ':') && (is(prev, '{') || is(prev, ','))) return false;
  return !(prev?.type === 'name' && ['const', 'let', 'var', 'function', 'class'].includes(prev.value));
}

// Compiles the body as Claude Code runs it, inside an async function, and
// returns null or `{ message, line }`. Nothing runs.
function compileError(body) {
  try {
    new AsyncFunction(body);
    return null;
  } catch (error) {
    let line = null;
    try {
      new Script(`(async function () {\n${body}\n})`, { filename: 'workflow.js' });
    } catch (located) {
      const m = /^workflow\.js:(\d+)/.exec(located.stack ?? '');
      if (m) line = Number(m[1]) - 1;
    }
    return { message: error.message, line };
  }
}

// The stages a script passes in order. A result's problem is the first one it
// fails, so a later stage means the script got further.
export const STAGES = ['first', 'literal', 'fields', 'compile', 'args', 'agent'];

// Reads one workflow script the way Claude Code loads it. Returns
// `{ ok: true, meta }` or `{ problem, ... }`, where problem is one of STAGES:
// 'first' (`found`: how the first statement starts), 'literal' (`what`,
// `line`), 'fields' (`missing`), 'compile' (`message`, `line`), 'args'
// (`declared`: a line, or `mentioned`: true when `args` shows up only in
// comments, strings or property names) and 'agent'. Options: `needArgs`, the
// script reads the `args` global; `needAgentCall`, it calls `agent()`.
export function readWorkflow(text, { needArgs = false, needAgentCall = false } = {}) {
  const source = text.replace(/^\uFEFF/, '');
  const tokens = tokenize(source);
  const [exp, decl, name, eq, open] = tokens;
  const word = (t, value) => t?.type === 'name' && t.value === value;
  if (!(word(exp, 'export') && word(decl, 'const') && word(name, 'meta') && is(eq, '='))) {
    const found = exp ? source.slice(exp.start).split(/\r?\n/)[0].trim() : '';
    return { problem: 'first', found: found.length > 40 ? `${found.slice(0, 40)}...` : found };
  }
  if (!is(open, '{')) return { problem: 'literal', what: 'something other than an object literal', line: eq.line };
  let meta;
  try {
    meta = literalObject(tokens, 4);
  } catch (failure) {
    if (!failure?.what) throw failure;
    return { problem: 'literal', what: failure.what, line: failure.line };
  }
  const missing = ['name', 'description'].filter((f) => typeof meta[f] !== 'string' || !meta[f].trim());
  if (missing.length) return { problem: 'fields', missing };
  const body = `${source.slice(0, exp.start)}${source.slice(exp.end)}`;
  const error = compileError(body);
  if (error) return { problem: 'compile', ...error };
  const named = (value) => tokens.flatMap((t, k) => (t.type === 'name' && t.value === value ? [k] : []));
  if (needArgs) {
    const args = named('args');
    const declared = args.find((k) => tokens[k - 1]?.type === 'name' && ['const', 'let', 'var'].includes(tokens[k - 1].value));
    if (declared !== undefined) return { problem: 'args', declared: tokens[declared].line };
    if (!args.some((k) => reads(tokens, k))) return { problem: 'args', mentioned: /\bargs\b/.test(source) };
  }
  if (needAgentCall && !named('agent').some((k) => reads(tokens, k) && is(tokens[k + 1], '('))) return { problem: 'agent' };
  return { ok: true, meta };
}
