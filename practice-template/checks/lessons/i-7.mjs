// Connect a tool with MCP (Intermediate, lesson 7). The Learner shares Chrome
// DevTools MCP at project scope in a committed .mcp.json, pinned to one
// version with the server's three outbound data flows turned off, and saves
// a repaired local demo and a PNG capture taken after the repair. The real MCP console observation
// remains a session self-check.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const title = 'Connect a tool with MCP';

const SHOT = '.practice/i-7-page.png';
const DEMO = '.practice/demo.html';
const DEMO_RUNNER = fileURLToPath(new URL('./i-7-demo.mjs', import.meta.url));
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function server(value) {
  const servers = value?.mcpServers ?? {};
  return Object.values(servers).find((s) => (s?.args ?? []).some((a) => /^chrome-devtools-mcp(@|$)/.test(String(a))));
}

const off = (args, name) => args.includes(`--no-${name}`) || args.includes(`--${name}=false`);

export const items = [
  {
    text: 'the committed `.mcp.json` runs chrome-devtools-mcp at an exact version, with usage statistics, CrUX lookups and update checks off',
    check(repo) {
      let text;
      try {
        text = repo.git('show', 'HEAD:./.mcp.json');
      } catch {
        return repo.exists('.mcp.json') ? '.mcp.json is not committed. Run `git add .mcp.json` and commit it: project-scope servers are shared through it.' : 'There is no .mcp.json at the repository root. Save the partial file from the lesson\'s Your turn there.';
      }
      let value;
      try {
        value = JSON.parse(text);
      } catch (error) {
        return `The committed .mcp.json is not valid JSON: ${error.message}`;
      }
      const s = server(value);
      if (!s) return 'No server in .mcp.json runs chrome-devtools-mcp. Add it under `mcpServers`, as in the lesson.';
      const args = (s.args ?? []).map(String);
      const pkg = args.find((a) => a.startsWith('chrome-devtools-mcp'));
      if (!/^chrome-devtools-mcp@\d+\.\d+\.\d+$/.test(pkg)) return `\`${pkg}\` isn't pinned. Name an exact version, such as \`chrome-devtools-mcp@1.10.1\`, so every teammate runs the code you reviewed.`;
      if (!off(args, 'usage-statistics')) return 'Usage statistics are still on. Add `--no-usage-statistics` to the args.';
      if (!off(args, 'performance-crux')) return 'Performance traces can still send URLs to Google\'s CrUX API. Add `--no-performance-crux` to the args.';
      if (!String(s.env?.CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS ?? '').trim()) return 'Update checks are still on. Set `CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS` to `"1"` in the server\'s `env`.';
      return true;
    },
  },
  {
    text: '`.practice/i-7-page.png` holds a PNG image of the repaired page',
    local: true,
    check(repo) {
      const path = join(repo.dir, SHOT);
      if (!existsSync(path)) return `There is no ${SHOT}. Ask Claude to use the chrome-devtools tools to open a page and save a screenshot to ${SHOT}.`;
      if (!readFileSync(path).subarray(0, 8).equals(PNG_SIGNATURE)) return `${SHOT} isn't a PNG image. Ask Claude to save the screenshot again, as a PNG.`;
      // The capture shows the repaired page only if it was saved after the
      // demo's last change.
      const demo = join(repo.dir, DEMO);
      return !existsSync(demo) || statSync(path).mtimeMs >= statSync(demo).mtimeMs ? true : `${SHOT} is older than your last change to ${DEMO}. Capture the page again after the repair.`;
    },
  },
  {
    text: 'the demo script displays `2 links ready` without a script error',
    local: true,
    check(repo) {
      const html = repo.read(DEMO);
      if (html === null) return `There is no ${DEMO}. Save the broken page from the Worked example, then use MCP to diagnose and repair it.`;
      const result = spawnSync(process.execPath, ['--max-old-space-size=32', DEMO_RUNNER], {
        input: html, encoding: 'utf8', timeout: 1500, maxBuffer: 16384, env: {},
      });
      let observed;
      try { observed = JSON.parse(result.stdout); } catch { observed = null; }
      if (result.error || result.status !== 0 || !observed || observed.error || observed.errors?.length) return 'The demo script fails. Use MCP to read the error, then fix its cause in .practice/demo.html.';
      return observed.counts?.[0] === '2 links ready' && observed.counts?.[1] === '3 links ready' ? true : "The demo count does not follow the page's links. Keep the calculation and fix the element it updates.";
    },
  },
];
