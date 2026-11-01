// The YAML frontmatter of a skill or subagent file, read without a YAML
// library. It covers what those files use: `key: value` lines, quoted
// values, folded and literal blocks (`key: >-`), and lists written as
// `[a, b]` or as `- item` lines, indented or not, and plain values that
// continue on indented lines. Comments, whole-line or after a value, and
// blank lines are skipped.
// Returns null when the file doesn't start with a --- line.

// A value: text, or a list's items.
export type FrontValue = string | string[];
export interface FrontMatter {
  fields: Record<string, FrontValue>;
  body: string;
}

const unquote = (value: string) => value.replace(/^(['"])(.*)\1$/, "$2");

// A value without its trailing ` # comment`. A quoted value keeps any # in it.
function uncomment(value: string) {
  const v = value.trim();
  const quoted = v.match(/^(['"]).*?\1/);
  if (quoted) return quoted[0];
  return v.replace(/\s+#.*$/, "");
}

function scalar(value: string): FrontValue {
  const v = uncomment(value);
  if (/^\[.*\]$/.test(v))
    return v
      .slice(1, -1)
      .split(",")
      .map((s) => unquote(s.trim()))
      .filter(Boolean);
  return unquote(v);
}

export function frontmatter(
  text: string | null | undefined,
): FrontMatter | null {
  const lines = (text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (end === -1) return null;
  const fields: Record<string, FrontValue> = {};
  let key: string | null = null;
  let block: { folded: boolean; lines: string[] } | null = null;
  let plain = false;
  for (const line of lines.slice(1, end)) {
    if (/^\s*#/.test(line) || !line.trim()) {
      if (block && !line.trim()) block.lines.push("");
      continue;
    }
    const top = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (top) {
      // The key's group is not optional.
      key = top[1] ?? "";
      const value = (top[2] ?? "").trim();
      block = /^[|>][+-]?$/.test(uncomment(value))
        ? { folded: uncomment(value).startsWith(">"), lines: [] }
        : null;
      plain = false;
      fields[key] = block ? "" : uncomment(value) === "" ? [] : scalar(value);
      continue;
    }
    // With no key yet, fields holds nothing to read.
    const field = key === null ? undefined : fields[key];
    const item = !block && !plain && Array.isArray(field) && /^-\s+/.test(line);
    if (!key || (!/^\s/.test(line) && !item)) continue;
    if (block) {
      block.lines.push(line.trim());
      fields[key] = block.lines
        .join(block.folded ? " " : "\n")
        .replace(/\s+$/, "");
    } else if (!plain && Array.isArray(field) && /^\s*-\s+/.test(line)) {
      field.push(unquote(uncomment(line.replace(/^\s*-\s+/, ""))));
    } else if (plain || (Array.isArray(field) && field.length === 0)) {
      // `key:` with its plain value on the next indented lines, joined by spaces.
      fields[key] = plain
        ? `${String(field)} ${uncomment(line)}`
        : unquote(uncomment(line));
      plain = true;
    }
  }
  return { fields, body: lines.slice(end + 1).join("\n") };
}
