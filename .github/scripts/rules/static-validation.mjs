// Config and example files parse before they merge:
// - JSON files, and YAML files (workflows, issue forms);
// - skill frontmatter has a description (name is optional);
// - agent frontmatter has a name and a description;
// - workflow scripts compile, once `export const meta =` becomes
//   `const meta =`, as the body of an async function (node --check gives
//   different answers on different Node versions);
// - shell scripts pass bash -n and shellcheck.
// This covers the live .claude/ folder and the inert dot-claude/ folders
// under examples/ alike, and the skills and agents of the plugins in an
// example marketplace: examples/**/plugins/<name>/skills/<skill>/SKILL.md and
// examples/**/plugins/<name>/agents/<agent>.md.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { frontmatter, parseYaml } from '../lib/yaml.mjs';

export const id = 'static-validation';
export const modes = ['pr', 'release'];

const SKILL = /(^|\/)(\.claude|dot-claude)\/skills\/[^/]+\/SKILL\.md$|^examples\/(.+\/)?plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/;
const AGENT = /(^|\/)(\.claude|dot-claude)\/agents\/[^/]+\.md$|^examples\/(.+\/)?plugins\/[^/]+\/agents\/[^/]+\.md$/;
const WORKFLOW = /(^|\/)(\.claude|dot-claude)\/workflows\/[^/]+\.m?js$/;
const SHEBANG = /^#!\s*\/(usr\/)?bin\/(env\s+)?(ba)?sh\b/;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function isShell(ctx, path) {
  if (path.endsWith('.sh')) return true;
  if (/\.[^/]+$/.test(path.split('/').pop())) return false;
  if (!path.startsWith('examples/') && !path.startsWith('.claude/')) return false;
  return SHEBANG.test(readText(ctx.root, path).split('\n', 1)[0]);
}

function tool(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') return { missing: true };
  return { code: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

export function run(ctx) {
  const problems = [];
  const yamlDocs = {};
  const fm = {};
  let counts = { json: 0, yaml: 0, skills: 0, agents: 0, workflows: 0, shell: 0 };

  for (const path of ctx.files) {
    if (path.endsWith('.json')) {
      counts.json += 1;
      try { JSON.parse(readText(ctx.root, path)); } catch (e) { problems.push(`${path}: not valid JSON: ${e.message}`); }
    } else if (/\.ya?ml$/.test(path)) {
      counts.yaml += 1;
      yamlDocs[path] = readText(ctx.root, path);
    }
    if (SKILL.test(path) || AGENT.test(path)) {
      const kind = SKILL.test(path) ? 'skill' : 'agent';
      counts[`${kind}s`] += 1;
      const text = frontmatter(readText(ctx.root, path));
      if (text === null) problems.push(`${path}: ${kind} file has no frontmatter`);
      else fm[path] = { kind, text };
    }
    if (WORKFLOW.test(path)) {
      counts.workflows += 1;
      const body = readText(ctx.root, path).replace(/^(\s*)export\s+const\s+meta\s*=/m, '$1const meta =');
      try { new AsyncFunction(body); } catch (e) { problems.push(`${path}: workflow script does not parse: ${e.message}`); }
    }
    if (isShell(ctx, path)) {
      counts.shell += 1;
      const syntax = tool('bash', ['-n', path], ctx.root);
      if (syntax.code !== 0) { problems.push(`${path}: bash -n: ${syntax.output}`); continue; }
      const lint = tool(process.env.SHELLCHECK || 'shellcheck', ['--format=gcc', path], ctx.root);
      if (lint.missing) problems.push(`${path}: shellcheck not found: install shellcheck or set SHELLCHECK to its path`);
      else if (lint.code !== 0) problems.push(...lint.output.split('\n').map((l) => `shellcheck: ${l}`));
    }
  }

  const parsed = parseYaml({ ...yamlDocs, ...Object.fromEntries(Object.entries(fm).map(([p, f]) => [`fm:${p}`, f.text])) });
  for (const path of Object.keys(yamlDocs)) {
    if (parsed[path].error) problems.push(`${path}: not valid YAML: ${parsed[path].error}`);
  }
  for (const [path, { kind }] of Object.entries(fm)) {
    const r = parsed[`fm:${path}`];
    if (r.error) { problems.push(`${path}: frontmatter is not valid YAML: ${r.error}`); continue; }
    const value = r.value && typeof r.value === 'object' ? r.value : {};
    const need = kind === 'skill' ? ['description'] : ['name', 'description'];
    for (const field of need) {
      if (typeof value[field] !== 'string' || !value[field].trim()) problems.push(`${path}: ${kind} frontmatter needs a "${field}"`);
    }
  }

  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') };
}
