// GitHub Actions helpers shared by Advanced lesson 5's check and the Advanced
// capstone: the workflows that run Claude Code through
// anthropics/claude-code-action, read from the repository's history without a
// YAML library. The reader covers what workflow files use: `key: value`
// lines, `- ` list items, quoted values, literal and folded blocks
// (`key: |`, `key: >-`), plain values that go on over more indented lines,
// one-line flow lists and maps (`[a, b]`, `{a: b}`), and `#` comments. It
// never runs a workflow, `gh` or Claude Code.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const WORKFLOWS = '.github/workflows';
// GitHub reads workflow files only directly in .github/workflows/.
const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const ACTION = /^anthropics\/claude-code-action(?:@(.*))?$/i;

const indentOf = (raw) => raw.match(/^ */)[0].length;
const isItem = (body) => /^-(\s|$)/.test(body);

// A value without its ` # comment`. A `#` inside quotes stays.
function uncomment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote === '"' && c === '\\') i += 1;
    else if (quote && c === quote) {
      if (quote === "'" && text[i + 1] === "'") i += 1;
      else quote = null;
    } else if (!quote && (c === '"' || c === "'") && (i === 0 || /[\s[{,:]/.test(text[i - 1]))) quote = c;
    else if (!quote && c === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i);
  }
  return text;
}

const DOUBLE_ESCAPES = { n: '\n', t: '\t', r: '\r', 0: '\0', '"': '"', '\\': '\\', '/': '/', ' ': ' ' };

// A scalar as YAML reads it: quotes removed and escapes applied.
function unquote(text) {
  const t = text.trim();
  if (/^"[\s\S]*"$/.test(t) && t.length > 1) return t.slice(1, -1).replace(/\\(.)/g, (_, c) => DOUBLE_ESCAPES[c] ?? c);
  if (/^'[\s\S]*'$/.test(t) && t.length > 1) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

// The index just past a quoted value's closing quote, or -1 while it is open.
function closing(text) {
  const quote = text[0];
  for (let i = 1; i < text.length; i += 1) {
    if (quote === '"' && text[i] === '\\') i += 1;
    else if (text[i] === quote) {
      if (quote === "'" && text[i + 1] === "'") i += 1;
      else return i + 1;
    }
  }
  return -1;
}

// `key: rest`, with the key unquoted, or null for a line that holds no key.
const KEY = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^']|'')*)'|([^\s#'"[\]{},&*!|>%@`-][^:]*?|-[^\s:][^:]*?))[ \t]*:(?=\s|$)(.*)$/;

function keyOf(body) {
  const m = body.match(KEY);
  if (!m) return null;
  const key = m[1] !== undefined ? unquote(`"${m[1]}"`) : m[2] !== undefined ? m[2].replace(/''/g, "'") : m[3].trim();
  return { key, rest: m[4] };
}

// Folded block lines, as `>` joins them: lines of the block's own indent
// join with a space, a blank line becomes a line break, and more indented
// lines keep theirs.
function fold(lines) {
  let out = '';
  let previous = null;
  for (const line of lines) {
    if (!line.trim()) {
      out += '\n';
      previous = 'blank';
      continue;
    }
    const more = /^\s/.test(line);
    if (previous === 'text' && !more) out += ' ';
    else if (previous && previous !== 'blank') out += '\n';
    out += line;
    previous = more ? 'more' : 'text';
  }
  return out;
}

// The top-level items of a one-line flow list or map, as written.
function flowItems(text) {
  const inner = text.trim().slice(1, -1);
  const items = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const c of inner) {
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '{') depth += 1;
    else if (c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

const balanced = (text) => {
  let depth = 0;
  for (const c of text.replace(/"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'/g, '')) {
    if (c === '[' || c === '{') depth += 1;
    if (c === ']' || c === '}') depth -= 1;
  }
  return depth <= 0;
};

// A flow map as `{ key: { text, line } }` entries, or a flow list as items.
function flowNode(text, line) {
  const t = text.trim();
  if (t.startsWith('{')) {
    const entries = flowItems(t).map((item) => {
      const at = item.search(/:(\s|$)/);
      const key = unquote(at === -1 ? item : item.slice(0, at));
      const value = at === -1 ? '' : item.slice(at + 1).trim();
      return { key, line, value: /^[[{]/.test(value) ? flowNode(value, line) : { type: 'scalar', text: unquote(value), line } };
    });
    return { type: 'map', entries, line };
  }
  return { type: 'seq', items: flowItems(t).map((item) => (/^[[{]/.test(item) ? flowNode(item, line) : { type: 'scalar', text: unquote(item), line })), line };
}

// The document as nodes: `{ type: 'map', entries: [{ key, line, value }] }`,
// `{ type: 'seq', items }` and `{ type: 'scalar', text, line, block }`, where
// `line` counts from 1 and `block` marks a `|` or `>` value.
export function parseYaml(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split('\n').map((raw, i) => ({ raw: raw.replace(/\r$/, '').replace(/\t/g, ' '), n: i + 1 }));
  let at = 0;
  const skippable = (l) => !l.raw.trim() || /^\s*#/.test(l.raw);
  const skip = () => {
    while (at < lines.length && skippable(lines[at])) at += 1;
  };
  const empty = (line) => ({ type: 'scalar', text: '', line: line.n, empty: true });

  // A plain value goes on over the lines indented more than `parent`.
  function plain(first, parent, line) {
    const parts = [first.trim()];
    while (at < lines.length) {
      const l = lines[at];
      if (!l.raw.trim()) {
        const next = lines.slice(at).find((x) => x.raw.trim());
        if (!next || indentOf(next.raw) <= parent || /^\s*#/.test(next.raw)) break;
        parts.push('\n');
        at += 1;
        continue;
      }
      if (indentOf(l.raw) <= parent || /^\s*#/.test(l.raw)) break;
      parts.push(uncomment(l.raw).trim());
      at += 1;
    }
    const joined = parts.reduce((out, p) => (p === '\n' ? `${out}\n` : out && !out.endsWith('\n') ? `${out} ${p}` : `${out}${p}`), '');
    return { type: 'scalar', text: joined, line: line.n };
  }

  function blockScalar(folded, parent, line) {
    const body = [];
    while (at < lines.length) {
      const l = lines[at];
      if (l.raw.trim() && indentOf(l.raw) <= parent) break;
      body.push(l.raw);
      at += 1;
    }
    while (body.length && !body.at(-1).trim()) body.pop();
    const filled = body.filter((s) => s.trim());
    const base = filled.length ? Math.min(...filled.map(indentOf)) : 0;
    const content = body.map((s) => (s.trim() ? s.slice(base) : ''));
    return { type: 'scalar', text: folded ? fold(content) : content.join('\n'), line: line.n, block: true };
  }

  function quoted(first, parent, line) {
    let text = first.trim();
    while (closing(text) === -1 && at < lines.length && (!lines[at].raw.trim() || indentOf(lines[at].raw) > parent)) {
      text += lines[at].raw.trim() ? ` ${lines[at].raw.trim()}` : '\n';
      at += 1;
    }
    const end = closing(text);
    return { type: 'scalar', text: unquote(end === -1 ? text : text.slice(0, end)), line: line.n, quoted: true };
  }

  function flow(first, parent, line) {
    let text = first;
    while (!balanced(text) && at < lines.length && indentOf(lines[at].raw) > parent) {
      text += ` ${uncomment(lines[at].raw).trim()}`;
      at += 1;
    }
    return flowNode(text, line.n);
  }

  // The value after `key:` or `- `, whose own lines are indented more than
  // `parent`. A list may also sit at the key's own indent.
  function value(rest, parent, line) {
    const text = uncomment(rest).trim();
    if (!text) {
      skip();
      if (at < lines.length) {
        const next = lines[at];
        const i = indentOf(next.raw);
        if (i > parent) return block(parent + 1) ?? empty(line);
        if (i === parent && isItem(next.raw.slice(i))) return sequence(parent);
      }
      return empty(line);
    }
    if (/^[|>][0-9+-]*$/.test(text)) return blockScalar(text[0] === '>', parent, line);
    if (/^["']/.test(text)) return quoted(rest.trim(), parent, line);
    if (/^[[{]/.test(text)) return flow(text, parent, line);
    return plain(text, parent, line);
  }

  function mapping(indent) {
    const entries = [];
    while (true) {
      skip();
      if (at >= lines.length) break;
      const line = lines[at];
      const i = indentOf(line.raw);
      if (i < indent) break;
      if (i > indent) {
        at += 1;
        continue;
      }
      const found = keyOf(line.raw.slice(i));
      if (!found) break;
      at += 1;
      entries.push({ key: found.key, line: line.n, value: value(found.rest, indent, line) });
    }
    return { type: 'map', entries };
  }

  function sequence(indent) {
    const items = [];
    while (true) {
      skip();
      if (at >= lines.length) break;
      const line = lines[at];
      const i = indentOf(line.raw);
      const body = line.raw.slice(i);
      if (i !== indent || !isItem(body)) break;
      const rest = body.slice(1);
      const pad = rest.match(/^\s*/)[0].length;
      const inner = rest.slice(pad);
      if (!uncomment(inner).trim()) {
        at += 1;
        items.push(block(indent + 1) ?? empty(line));
      } else if (keyOf(inner)) {
        // `- key: value` starts a map whose keys line up after the dash.
        line.raw = `${' '.repeat(i + 1 + pad)}${inner}`;
        items.push(mapping(i + 1 + pad));
      } else {
        at += 1;
        items.push(value(inner, indent, line));
      }
    }
    return { type: 'seq', items };
  }

  function block(min) {
    skip();
    if (at >= lines.length) return null;
    const line = lines[at];
    const i = indentOf(line.raw);
    if (i < min) return null;
    const body = line.raw.slice(i);
    if (isItem(body)) return sequence(i);
    if (keyOf(body)) return mapping(i);
    at += 1;
    return value(body, i - 1, line);
  }

  return block(0) ?? { type: 'map', entries: [] };
}

// The last entry for `key` in a map node, as YAML keeps the last of a
// repeated key.
export const entryOf = (node, key) => (node?.type === 'map' ? node.entries.findLast((e) => e.key === key) : undefined);

const scalarText = (node) => (node?.type === 'scalar' ? node.text : null);

// The events in `on:`: one name, a list of names, or a map of names.
function triggersOf(doc) {
  const on = entryOf(doc, 'on')?.value;
  if (!on) return [];
  if (on.type === 'scalar') return on.text ? [on.text.trim()] : [];
  if (on.type === 'seq') return on.items.map(scalarText).filter(Boolean).map((t) => t.trim());
  return on.entries.map((e) => e.key);
}

// Permissions as written, or null without a `permissions` key: `{ line,
// all }` for `read-all` or `write-all`, else `{ line, scopes: [{ scope,
// level, line }] }`.
function permissionsOf(node) {
  const entry = entryOf(node, 'permissions');
  if (!entry) return null;
  const v = entry.value;
  if (v.type === 'scalar') return v.empty ? { line: entry.line, scopes: [] } : { line: entry.line, all: v.text.trim() };
  if (v.type === 'map') return { line: entry.line, scopes: v.entries.map((e) => ({ scope: e.key, level: String(scalarText(e.value) ?? '').trim(), line: e.line })) };
  return { line: entry.line, scopes: [] };
}

const valueAt = (node, key) => {
  const entry = entryOf(node, key);
  if (!entry) return null;
  return { text: scalarText(entry.value), line: entry.line, block: Boolean(entry.value.block), empty: Boolean(entry.value.empty) };
};

// Every step in a workflow that uses anthropics/claude-code-action, with
// what the checks read: `{ line, ref, inputs, job, jobLine, stepTimeout,
// jobTimeout, permissions, triggers }`. `ref` is what follows the `@`, or
// null; `inputs` maps each `with:` key to `{ text, line, block, empty }`;
// `permissions` is the job's own, else the workflow's.
export function readWorkflow(text) {
  const doc = parseYaml(text);
  const triggers = triggersOf(doc);
  const top = permissionsOf(doc);
  const jobs = entryOf(doc, 'jobs')?.value;
  const steps = [];
  for (const job of jobs?.type === 'map' ? jobs.entries : []) {
    const list = entryOf(job.value, 'steps')?.value;
    for (const step of list?.type === 'seq' ? list.items : []) {
      const uses = entryOf(step, 'uses');
      const m = String(scalarText(uses?.value) ?? '').trim().match(ACTION);
      if (!m) continue;
      const withs = entryOf(step, 'with')?.value;
      const inputs = {};
      for (const e of withs?.type === 'map' ? withs.entries : []) inputs[e.key] = valueAt(withs, e.key);
      steps.push({
        line: uses.line,
        ref: m[1] === undefined ? null : m[1],
        inputs,
        job: job.key,
        jobLine: job.line,
        stepTimeout: valueAt(step, 'timeout-minutes'),
        jobTimeout: valueAt(job.value, 'timeout-minutes'),
        permissions: permissionsOf(job.value) ?? top,
        triggers,
      });
    }
  }
  return { triggers, steps };
}

const z = (text) => text.split('\0').filter(Boolean);

function listFiles(repo, commit) {
  try {
    return z(repo.gitLocal('ls-tree', '-z', commit, '--', `${WORKFLOWS}/`))
      .map((entry) => entry.match(/^\d+ (\w+) ([0-9a-f]+)\t(.*)$/s))
      .filter((m) => m && m[1] === 'blob' && WORKFLOW_FILE.test(m[3]))
      .map((m) => ({ blob: m[2], path: m[3] }));
  } catch {
    return [];
  }
}

const caches = new WeakMap();

function cacheOf(repo) {
  if (!caches.has(repo)) caches.set(repo, { blobs: new Map(), commits: new Map(), history: null });
  return caches.get(repo);
}

// The workflow files committed at `commit` that run the action, each `{
// commit, path, blob, text, steps }`, sorted by path.
export function claudeWorkflowsAt(repo, commit) {
  const cache = cacheOf(repo);
  if (!cache.commits.has(commit)) {
    const files = listFiles(repo, commit).map(({ blob, path }) => {
      if (!cache.blobs.has(blob)) {
        let text = '';
        try {
          text = repo.gitLocal('cat-file', 'blob', blob);
        } catch {
          // An object missing from a partial clone reads as an empty file.
        }
        cache.blobs.set(blob, { text, ...readWorkflow(text) });
      }
      const { text, steps } = cache.blobs.get(blob);
      return { commit, path, blob, text, steps };
    });
    cache.commits.set(commit, files.filter((f) => f.steps.length).sort((a, b) => (a.path < b.path ? -1 : 1)));
  }
  return cache.commits.get(commit);
}

// The commits in HEAD's history that changed .github/workflows/, newest
// first, each `{ commit, files }` with the workflow files that run the
// action at that commit; commits with none are left out, so a commit that
// deleted the workflows doesn't hide the ones before it. `--full-history`
// walks both sides of a merge: by default, git follows only the parent whose
// workflows the merge kept, which can hide the other side's.
export function claudeHistory(repo) {
  const cache = cacheOf(repo);
  if (!cache.history) {
    let commits = [];
    try {
      commits = repo.gitLocal('log', '--full-history', '--format=%H', '--', WORKFLOWS).split('\n').filter(Boolean);
    } catch {
      // No commits yet.
    }
    cache.history = commits.map((commit) => ({ commit, files: claudeWorkflowsAt(repo, commit) })).filter((c) => c.files.length);
  }
  return cache.history;
}

// Workflow files in the working tree that run the action while HEAD's copy
// doesn't (or HEAD has none), each `{ path, tracked }`.
export function uncommittedWorkflows(repo) {
  let names = [];
  try {
    names = readdirSync(join(repo.dir, WORKFLOWS)).filter((n) => /\.ya?ml$/.test(n)).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const path = `${WORKFLOWS}/${name}`;
    const text = repo.read(path);
    if (text === null || !readWorkflow(text).steps.length) continue;
    let committed = null;
    try {
      committed = repo.git('show', `HEAD:${path}`);
    } catch {
      // Not in HEAD.
    }
    if (committed === null || !readWorkflow(committed).steps.length) out.push({ path, tracked: committed !== null });
  }
  return out;
}

// The blob HEAD holds at `path`, or null.
export function headBlob(repo, path) {
  try {
    return repo.git('rev-parse', '--verify', '--quiet', `HEAD:${path}`) || null;
  } catch {
    return null;
  }
}

// `claude_args` read the way the action reads it at v1.0.237
// (base-action/src/parse-sdk-options.ts): lines that start with `#` are
// dropped, then the rest is split into words as a shell would, with
// shell-quote, where an unquoted `#` starts a comment that runs to the end
// of the whole value. Returns `{ words, comment }`, where `comment` is the
// text the action skips, or null.
export function claudeArgWords(text) {
  const kept = String(text ?? '').split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  const words = [];
  let current = null;
  let quote = null;
  for (let i = 0; i < kept.length; i += 1) {
    const c = kept[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else current += c;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && /["\\$`]/.test(kept[i + 1] ?? '')) current += kept[(i += 1)];
      else current += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      current ??= '';
    } else if (c === '\\' && i + 1 < kept.length) {
      current = `${current ?? ''}${kept[(i += 1)]}`;
    } else if (/\s/.test(c)) {
      if (current !== null) words.push(current);
      current = null;
    } else if (c === '#') {
      if (current) words.push(current);
      return { words, comment: kept.slice(i) };
    } else {
      current = `${current ?? ''}${c}`;
    }
  }
  if (current !== null) words.push(current);
  return { words, comment: null };
}
