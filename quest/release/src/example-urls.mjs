// The example-fetch rewrite: the raw URL prefix at main becomes the same
// prefix at the release ref, and the example paths a page fetches through it.
export const RAW_PREFIX =
  "https://raw.githubusercontent.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/";

export function rewriteExampleUrls(text, ref) {
  return text.replaceAll(`${RAW_PREFIX}main/`, `${RAW_PREFIX}${ref}/`);
}

const URL_PATH = /[^\s"'<>)`]*/y;

// Expands $name and ${name} in a path from the variables in scope.
function expand(path, vars) {
  let out = [path];
  for (const [name, values] of Object.entries(vars)) {
    const source = `\\$\\{?${name}\\}?(?!\\w)`;
    const uses = new RegExp(source);
    const every = new RegExp(source, "g");
    out = out.flatMap((p) =>
      uses.test(p) ? values.map((v) => p.replace(every, v)) : [p],
    );
  }
  return out;
}

// Every repo path a page fetches through the prefix at main, read from the
// shell it shows: a URL written out, a `name=URL` base joined later as
// "$name/file", and `for x in a b; do ... done` loops over either. A shell
// idiom it doesn't know leaves a `$` in the path, which the release test
// reports.
export function examplePaths(text) {
  const prefix = `${RAW_PREFIX}main/`;
  const bases = {};
  const loops = [];
  const paths = new Set();
  for (const line of text.split(/\r?\n/)) {
    const vars = Object.fromEntries(loops.map((l) => [l.name, l.values]));
    const loop = line.match(/^\s*for\s+(\w+)\s+in\s+(.+?)\s*;\s*do\s*$/);
    if (loop) {
      loops.push({ name: loop[1], values: loop[2].split(/\s+/) });
      continue;
    }
    if (/^\s*done\b/.test(line)) {
      loops.pop();
      continue;
    }
    const base = line.match(/^\s*(\w+)=["']?(\S+?)["']?\s*$/);
    if (base?.[2].startsWith(prefix)) {
      bases[base[1]] = base[2].slice(prefix.length).replace(/\/$/, "");
      continue;
    }
    for (
      let at = line.indexOf(prefix);
      at !== -1;
      at = line.indexOf(prefix, at + 1)
    ) {
      URL_PATH.lastIndex = at + prefix.length;
      const path = URL_PATH.exec(line)?.[0] ?? "";
      for (const p of expand(path, vars)) paths.add(p);
    }
    for (const [name, dir] of Object.entries(bases)) {
      const use = new RegExp(`\\$\\{?${name}\\}?(/[^\\s"'<>)\`]*)`, "g");
      for (const m of line.matchAll(use))
        for (const p of expand(`${dir}${m[1]}`, vars)) paths.add(p);
    }
  }
  return [...paths].sort();
}

// Each example path the texts fetch that is missing from the tree at the ref.
export function checkExamples(texts, filesAtRef) {
  const have = new Set(filesAtRef);
  const problems = [];
  for (const [path, text] of Object.entries(texts))
    for (const example of examplePaths(text))
      if (!have.has(example))
        problems.push(
          `${path}: fetches ${example}, which is not in the tree at the release ref`,
        );
  return problems;
}
