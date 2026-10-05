// Parses YAML with Ruby's standard library, which GitHub's Ubuntu runners
// ship, so the checks need no npm packages. Takes { key: text } and returns
// { key: { value } | { error } }.
import { spawnSync } from 'node:child_process';

const RUBY = `
require "yaml"; require "json"; require "date"
out = {}
JSON.parse(STDIN.read).each do |key, text|
  begin
    out[key] = { "value" => YAML.safe_load(text, permitted_classes: [Date, Time], aliases: true) }
  rescue Exception => e
    out[key] = { "error" => e.message.gsub(/\\s+/, " ") }
  end
end
print JSON.generate(out)
`;

export function parseYaml(docs) {
  if (Object.keys(docs).length === 0) return {};
  const result = spawnSync('ruby', ['-e', RUBY], { input: JSON.stringify(docs), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new Error('ruby not found: the YAML checks need Ruby 2.6 or later, with its standard library');
  if (result.status !== 0) throw new Error(`ruby exited ${result.status}: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}

// The YAML between the opening and closing --- of a Markdown file, or null.
export function frontmatter(markdown) {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/);
  return m ? m[1] : null;
}
