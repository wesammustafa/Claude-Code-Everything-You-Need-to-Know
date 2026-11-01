// One Guide page as a sanitized HTML fragment, the way GitHub shows it:
// heading ids from the Guide checks' slug rule, GitHub callouts, plain code
// blocks, Mermaid blocks as light and dark SVG files, and links rewritten
// for the release (links.mjs).
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { slug } from "../../../.github/scripts/lib/markdown.mjs";
import { rewriteHref } from "./links.mjs";

const ALERTS = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Caution",
};
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/;
const TASK = /^\[[ xX]\] /;
const HREF = /(\bhref\s*=\s*)(["'])(.*?)\2/gi;
const SRC =
  /(?<![\w-])src\s*=\s*(["'])(.*?)\1|(?<![\w-])src\s*=\s*([^\s"'>]+)/gi;
const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|(amp|quot|apos|lt|gt));/gi;
const NAMED = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };

// An attribute value from raw HTML as the browser reads it, so it is
// escaped once on the way out.
function decodeEntities(value) {
  return value.replace(ENTITY, (all, dec, hex, name) =>
    name
      ? NAMED[name.toLowerCase()]
      : String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)),
  );
}

function escapeAttr(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// > [!NOTE] blockquotes become GitHub's alert markup. Runs on the block
// tokens, before inline parsing, so the marker line is dropped from the
// first paragraph's source.
function alerts(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open.type !== "blockquote_open") continue;
    const inline = tokens[i + 2];
    if (tokens[i + 1]?.type !== "paragraph_open" || inline?.type !== "inline")
      continue;
    const m = inline.content.match(ALERT);
    if (!m) continue;
    const name = m[1].toLowerCase();
    let depth = 0;
    let close = i;
    for (; close < tokens.length; close++) {
      if (tokens[close].type === "blockquote_open") depth++;
      if (tokens[close].type === "blockquote_close" && --depth === 0) break;
    }
    const block = (content) => {
      const token = new state.Token("html_block", "", 0);
      token.content = content;
      return token;
    };
    tokens[close] = block("</div>\n");
    tokens[i] = block(
      `<div class="markdown-alert markdown-alert-${name}">\n<p class="markdown-alert-title">${ALERTS[m[1]]}</p>\n`,
    );
    inline.content = inline.content.slice(m[0].length);
    if (inline.content.trim() === "") tokens.splice(i + 1, 3);
  }
}

// A task-list item's leading [ ] , [x] or [X] is dropped, so self-check
// lists render as plain lists with no box. Runs after inline parsing, on the
// first text child of each item's first paragraph, before text_join merges a
// backslash escape into it, so \[ ] stays literal as on GitHub.
function taskMarkers(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "list_item_open") continue;
    const inline = tokens[i + 2];
    if (tokens[i + 1]?.type !== "paragraph_open" || inline?.type !== "inline")
      continue;
    const child = inline.children?.[0];
    if (child?.type !== "text" || !TASK.test(child.content)) continue;
    child.content = child.content.replace(TASK, "");
    inline.content = inline.content.replace(TASK, "");
  }
}

// Heading ids by GitHub's rule, numbered -1, -2, ... in document order, as
// the Guide checks' pageIds() has them.
function headingIds(state) {
  const seen = new Map();
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "heading_open") continue;
    const base = slug(tokens[i + 1].content.replace(/\n/g, " "));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    tokens[i].attrSet("id", n === 0 ? base : `${base}-${n}`);
  }
}

// Rewrites every link, in Markdown and in raw HTML, and records it with its
// line for the release test. A relative image fails the build: none is
// bundled.
function links(state) {
  if (state.env.skipLinks) return;
  const { page, ctx, found } = state.env;
  const rewrite = (target, line) => {
    const out = rewriteHref(page, target, ctx);
    found.push({ line, target, ...out });
    return out;
  };
  const image = (src, line) => {
    if (rewriteHref(page, src, ctx).path !== null)
      throw new Error(
        `${page}:${line}: relative image ${src}: the page renderer bundles no images`,
      );
  };
  const html = (content, line) => {
    for (const m of content.matchAll(SRC))
      image(decodeEntities(m[2] ?? m[3]), line);
    return content.replace(HREF, (all, attr, quote, target) => {
      const out = rewrite(decodeEntities(target), line);
      const extra = Object.entries(out.attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join("");
      return `${attr}${quote}${escapeAttr(out.href)}${quote}${extra}`;
    });
  };
  for (const token of state.tokens) {
    const first = (token.map?.[0] ?? 0) + 1;
    if (token.type === "html_block") token.content = html(token.content, first);
    if (token.type !== "inline") continue;
    let line = first;
    for (const child of token.children ?? []) {
      if (child.type === "softbreak" || child.type === "hardbreak") line++;
      if (child.type === "html_inline")
        child.content = html(child.content, line);
      if (child.type === "image") image(child.attrGet("src") ?? "", line);
      if (child.type !== "link_open") continue;
      const out = rewrite(child.attrGet("href") ?? "", line);
      child.attrSet("href", out.href);
      for (const [k, v] of Object.entries(out.attrs)) child.attrSet(k, v);
    }
  }
}

export function markdown() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    langPrefix: "language-",
  });
  md.core.ruler.after("block", "github_alerts", alerts);
  md.core.ruler.before("text_join", "task_markers", taskMarkers);
  md.core.ruler.push("heading_ids", headingIds);
  md.core.ruler.push("release_links", links);
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.info.trim() !== "mermaid")
      return fence(tokens, idx, options, env, self);
    const n = ++env.diagramCount;
    const { light, dark, alt } = env.diagram(n, token.content);
    return `<picture class="diagram" data-light="${escapeAttr(light)}" data-dark="${escapeAttr(dark)}"><source media="(prefers-color-scheme: dark)" srcset="${escapeAttr(dark)}"><img src="${escapeAttr(light)}" alt="${escapeAttr(alt)}"></picture>\n`;
  };
  return md;
}

const md = markdown();

/** The text of a Mermaid block's accTitle. */
export function accTitle(source) {
  return source.match(/^\s*accTitle\s*:\s*(.+?)\s*$/m)?.[1] ?? "";
}

/** A page's Mermaid blocks, in order. */
export function diagramSources(text) {
  return md
    .parse(text, { page: "", ctx: null, found: [], skipLinks: true })
    .filter((t) => t.type === "fence" && t.info.trim() === "mermaid")
    .map((t) => t.content);
}

const TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "blockquote",
  "ul",
  "ol",
  "li",
  "pre",
  "code",
  "em",
  "strong",
  "del",
  "s",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sub",
  "sup",
  "kbd",
  "details",
  "summary",
  "div",
  "span",
  "picture",
  "source",
];
const HEADING_ID = Object.fromEntries(
  ["h1", "h2", "h3", "h4", "h5", "h6"].map((h) => [h, ["id"]]),
);

export const SANITIZE = {
  allowedTags: TAGS,
  allowedAttributes: {
    ...HEADING_ID,
    a: ["id", "name", "href", "data-page", "data-fragment"],
    img: ["src", "alt", "width", "height"],
    source: ["srcset", "media"],
    picture: ["data-light", "data-dark"],
    ol: ["start"],
    "*": ["class"],
  },
  allowedClasses: { "*": ["markdown-alert*", "language-*", "diagram"] },
  allowedSchemes: ["http", "https"],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: ["href", "src", "srcset"],
  allowProtocolRelative: false,
  selfClosing: [...sanitizeHtml.defaults.selfClosing, "source"],
  disallowedTagsMode: "discard",
};

export function sanitize(html) {
  return sanitizeHtml(html, SANITIZE);
}

/**
 * One page: { html, title, links, diagrams }. `diagram(n, source)` names the
 * nth Mermaid block's files: { light, dark, alt }.
 */
export function renderPage(page, text, ctx, diagram) {
  const env = { page, ctx, found: [], diagramCount: 0, diagram };
  const tokens = md.parse(text, env);
  const h1 = tokens.findIndex(
    (t) => t.type === "heading_open" && t.tag === "h1",
  );
  const title =
    h1 === -1
      ? ""
      : (tokens[h1 + 1].children ?? [])
          .map((c) =>
            c.type === "softbreak"
              ? " "
              : c.type === "text" || c.type === "code_inline"
                ? c.content
                : "",
          )
          .join("");
  const html = sanitize(md.renderer.render(tokens, md.options, env));
  return { html, title, links: env.found, diagrams: env.diagramCount };
}
