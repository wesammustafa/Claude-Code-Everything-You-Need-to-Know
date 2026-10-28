// A bounded adapter for this lesson's tiny inline-script demo, not a browser.
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

try {
  const html = readFileSync(0, 'utf8');
  const nodes = Object.fromEntries([...html.matchAll(/<p\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => [`#${m[1]}`, { textContent: m[2] }]));
  const links = [...html.matchAll(/<a\b[^>]*>/gi)].length;
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const observed = { counts: [], errors: [] };
  // Vary the input collection without inspecting or rewriting the learner's code.
  for (const extra of [0, 1]) {
    const context = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    // Build the adapter inside the context; no host functions or objects enter it.
    runInContext(`
      (() => {
      const nodes = ${JSON.stringify(nodes)};
      const links = Array.from({ length: ${links + extra} }, () => ({}));
      const errors = [];
      globalThis.__i7Errors = errors;
      globalThis.document = {
        querySelector(selector) { return nodes[selector] ?? null; },
        getElementById(id) { return nodes['#' + id] ?? null; },
        querySelectorAll(selector) { return selector === 'a' ? links : []; }
      };
      globalThis.console = { log() {}, warn() {}, error(...values) { errors.push(values.map(String).join(' ')); } };
      })();
    `, context, { timeout: 100 });
    for (const script of scripts) runInContext(script, context, { timeout: 100 });
    const result = JSON.parse(runInContext("JSON.stringify({ count: document.querySelector('#link-count')?.textContent, errors: __i7Errors })", context, { timeout: 100 }));
    observed.counts.push(result.count);
    observed.errors.push(...result.errors);
  }
  process.stdout.write(JSON.stringify(observed));
} catch (error) {
  process.stdout.write(JSON.stringify({ error: String(error.message).slice(0, 160) }));
}
