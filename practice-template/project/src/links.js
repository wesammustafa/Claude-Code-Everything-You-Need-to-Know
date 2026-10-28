// Finds inline Markdown links, [text](target), outside code blocks.
export function findLinks(markdown) {
  const links = [];
  let inFence = false;
  markdown.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const prose = line.replace(/`[^`]*`/g, '');
    for (const m of prose.matchAll(/(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g)) {
      links.push({ text: m[1], target: m[2], line: i + 1 });
    }
  });
  return links;
}

export function isExternal(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}
