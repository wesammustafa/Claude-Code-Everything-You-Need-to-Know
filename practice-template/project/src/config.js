// Parses linkcheck.json. Every field is optional:
//   files:  files or folders to scan for Markdown links (default ["."])
//   ignore: link targets to skip, matched as prefixes (default [])
export const DEFAULTS = { files: ['.'], ignore: [] };

export function parseConfig(text) {
  const raw = JSON.parse(text);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('linkcheck.json must hold a JSON object');
  }
  const config = { ...DEFAULTS, ...raw };
  for (const key of ['files', 'ignore']) {
    if (!Array.isArray(config[key]) || !config[key].every((v) => typeof v === 'string')) {
      throw new Error(`linkcheck.json: "${key}" must be a list of strings`);
    }
  }
  return config;
}
