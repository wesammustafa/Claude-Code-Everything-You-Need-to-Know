// The local repair check must observe the demo's result, not just its screenshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, commit, repo, withRepo, write } from './helpers.mjs';

const MCP = JSON.stringify({ mcpServers: { 'chrome-devtools': {
  type: 'stdio', command: 'npx',
  args: ['-y', 'chrome-devtools-mcp@1.10.1', '--isolated', '--no-usage-statistics', '--no-performance-crux'],
  env: { CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1' },
} } });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const demo = (script) => `<!doctype html>\n<title>Linkcheck demo</title>\n<a href="#guide">Guide</a> <a href="#reference">Reference</a>\n<p id="link-count">Counting links...</p>\n<script>\nconst links = document.querySelectorAll('a');\n${script}\n</script>\n`;
const fixed = demo("document.querySelector('#link-count').textContent = `${links.length} links ready`;");
function repairedRepo(html = fixed) {
  const dir = repo({ '.mcp.json': MCP });
  commit(dir, 'Share Chrome DevTools MCP', ['.mcp.json']);
  if (html !== null) write(dir, { '.practice/demo.html': html });
  write(dir, { '.practice/i-7-page.png': PNG });
  return dir;
}

for (const [name, html, expected] of [
  ['the selector mismatch still throws', demo("document.querySelector('#link-total').textContent = `${links.length} links ready`;"), 1],
  ['the repaired script updates the result element', fixed, 0],
  ['a repair by element id updates the result element', demo("document.getElementById('link-count').textContent = `${links.length} links ready`;"), 0],
  ['suppressing the exception leaves the count broken', demo("try { document.querySelector('#link-total').textContent = `${links.length} links ready`; } catch {}"), 1],
  ['a static count without a script is not a repair', '<p id="link-count">2 links ready</p>', 1],
  ['a hardcoded assignment does not count the links', demo("document.querySelector('#link-count').textContent = '2 links ready';"), 1],
  ['a console error is not a clean repair', demo("document.querySelector('#link-count').textContent = `${links.length} links ready`; console.error('still broken');"), 1],
  ['the demo is missing', null, 1],
  ['the script never finishes', demo('while (true) {}'), 1],
]) {
  test(`i-7 repair: ${name}`, () => {
    withRepo(() => repairedRepo(html), (dir) => {
      const { code, out } = check(['i-7', '--dir', dir]);
      assert.equal(code, expected, out);
      if (expected) assert.match(out, /demo|count/i);
    });
  });
}
