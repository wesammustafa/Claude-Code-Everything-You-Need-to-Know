// The page renderer on the real tree: which pages render, their heading ids,
// the sanitizer, the reviewed fixture and a byte-identical second build.
// Regenerate the fixture with `npx vitest run quest/release/test/pages.test.ts -u`
// and review it by eye.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  accTitle,
  buildPages,
  cachedDiagram,
  classifyDocs,
  mermaidVersion,
  pageIds,
  pageName,
  readLock,
  releaseRef,
  renderPage,
  rewriteExampleUrls,
  sanitize,
} from "../src/pages.mjs";
import {
  diagramsDir,
  fixtures,
  realContext,
  removeTemp,
  repoRoot,
  tempDir,
} from "./pages-fixture";

afterAll(removeTemp);

const docs = classifyDocs(repoRoot);
const ctx = realContext("v0000.00");
const noDiagram = (_n: number, source: string) => ({
  light: "x.light.svg",
  dark: "x.dark.svg",
  alt: accTitle(source),
});

describe("the page set", () => {
  test("is every live docs/ page: no Stub, README or ADR", () => {
    expect(docs.live.map(pageName)).toEqual([
      "advanced/01-parallel-sessions",
      "advanced/02-orchestration-patterns",
      "advanced/03-dynamic-workflows",
      "advanced/04-headless",
      "advanced/05-github-actions",
      "advanced/06-share-your-setup",
      "advanced/07-bounded-runs",
      "advanced/beyond-this-guide",
      "advanced/capstone",
      "advanced/electives/agent-teams",
      "advanced/electives/agent-view",
      "advanced/electives/dev-containers",
      "advanced/electives/goal-loop-routines",
      "advanced/electives/publish-a-plugin",
      "beginner/01-install-and-look-around",
      "beginner/02-permission-modes-and-plan-mode",
      "beginner/03-first-change",
      "beginner/04-keep-a-session-on-track",
      "beginner/05-project-memory",
      "beginner/capstone",
      "beginner/electives/built-in-teachers",
      "beginner/electives/ide-extensions",
      "beginner/electives/screenshots-and-images",
      "intermediate/01-first-skill",
      "intermediate/02-organize-memory",
      "intermediate/03-model-and-effort",
      "intermediate/04-permissions-and-sandbox",
      "intermediate/05-hooks",
      "intermediate/06-subagents",
      "intermediate/07-mcp",
      "intermediate/08-plugins",
      "intermediate/capstone",
      "intermediate/electives/claude-in-chrome",
      "intermediate/electives/fast-mode",
      "intermediate/electives/skill-patterns",
      "intermediate/electives/status-line",
      "reference/commands",
      "reference/feature-map",
      "reference/further-reading",
      "reference/glossary",
      "reference/models",
      "topics/automation",
      "topics/hooks",
      "topics/mcp",
      "topics/memory-and-context",
      "topics/models-effort-and-cost",
      "topics/permissions-and-safety",
      "topics/plugins",
      "topics/skills",
      "topics/subagents-and-parallel-work",
    ]);
    expect(docs.readmes).toHaveLength(5);
    expect(docs.stubs).toHaveLength(9);
    expect(docs.unpublished).toEqual([
      "docs/adr/0001-separate-course-machinery-from-the-learner-project.md",
    ]);
  });
});

describe("heading ids", () => {
  test.each(docs.live)("%s has the ids the Guide checks give it", (path) => {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const { html } = renderPage(path, text, ctx, noDiagram);
    const ids = [
      ...html.matchAll(/<(?:h[1-6]|a)\b[^>]*?\s(?:id|name)="([^"]+)"/g),
    ].map((m) => m[1]);
    // Sorted: an <a id> inside a heading comes before the heading's own id
    // in pageIds() and after it in the HTML.
    expect(ids.sort()).toEqual(pageIds(text).sort());
  });
});

describe("the sanitizer", () => {
  test("strips scripts, handlers, styles and javascript: links", () => {
    const out = sanitize(
      '<p style="color:red" onclick="x()">a<script>alert(1)</script><a href="javascript:alert(1)">b</a><iframe src="https://example.com"></iframe><img src="x.svg" onerror="x()" alt="c"></p>',
    );
    expect(out).toBe('<p>a<a>b</a><img src="x.svg" alt="c" /></p>');
  });

  test("keeps only the allowed classes and attributes", () => {
    expect(
      sanitize(
        '<div class="markdown-alert markdown-alert-note evil"><code class="language-bash other">x</code></div><a href="#a" data-page="docs/a.md" data-fragment="a" data-x="1" target="_blank">a</a>',
      ),
    ).toBe(
      '<div class="markdown-alert markdown-alert-note"><code class="language-bash">x</code></div><a href="#a" data-page="docs/a.md" data-fragment="a">a</a>',
    );
  });

  test("decodes a raw HTML href once and escapes it once", () => {
    const { html } = renderPage(
      "docs/intermediate/05-hooks.md",
      '<a href="https://e.com/?a=1&amp;b=2">q</a>',
      ctx,
      noDiagram,
    );
    expect(html).toContain('href="https://e.com/?a=1&amp;b=2"');
  });

  test("fails a relative image in raw HTML", () => {
    expect(() =>
      renderPage(
        "docs/intermediate/05-hooks.md",
        '<p><img src=x onerror="alert(1)"></p>',
        ctx,
        noDiagram,
      ),
    ).toThrow(/relative image x/);
  });

  test("refuses a form and a protocol-relative link", () => {
    expect(
      sanitize(
        '<form action="/x"><input name="a"></form><a href="//evil.example">b</a>',
      ),
    ).toBe("<a>b</a>");
  });
});

test("a page with callouts, code and a diagram matches the reviewed fixture", async () => {
  const lock = readLock(diagramsDir);
  const version = mermaidVersion(repoRoot);
  const text = readFileSync(join(fixtures, "sample.md.txt"), "utf8");
  const { html, title } = renderPage(
    "docs/intermediate/sample.md",
    rewriteExampleUrls(text, "v0000.00"),
    ctx,
    (n, source) => {
      // The fixture draws the hooks lesson's diagram, so its SVG is the one
      // committed for that page.
      for (const theme of ["light", "dark"])
        cachedDiagram(
          diagramsDir,
          lock,
          version,
          "intermediate/05-hooks",
          n,
          source,
          theme,
        );
      return {
        light: `sample.d${String(n)}.light.svg`,
        dark: `sample.d${String(n)}.dark.svg`,
        alt: accTitle(source),
      };
    },
  );
  expect(title).toBe("A sample page");
  await expect(html).toMatchFileSnapshot("fixtures/pages/sample.html.txt");
});

function tree(dir: string): Record<string, string> {
  const files: [string, string][] = readdirSync(dir, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((e) => e.isFile())
    .map((e) => {
      const path = join(e.parentPath, e.name);
      return [path.slice(dir.length), readFileSync(path, "base64")];
    });
  return Object.fromEntries(files.sort(([a], [b]) => (a < b ? -1 : 1)));
}

describe("task lists", () => {
  const render = (md: string) =>
    renderPage("docs/intermediate/05-hooks.md", md, ctx, noDiagram).html;

  test("drops the marker from a tight list, with no box", () => {
    const html = render("- [ ] One\n- [x] Two\n- [X] Three\n");
    expect(html).toContain("<li>One</li>");
    expect(html).toContain("<li>Two</li>");
    expect(html).toContain("<li>Three</li>");
    for (const s of ["[ ]", "[x]", "[X]", "<input"])
      expect(html).not.toContain(s);
  });

  test("drops the marker from a loose list", () => {
    expect(render("- [ ] One\n\n- [ ] Two\n")).toContain(
      "<li>\n<p>One</p>\n</li>",
    );
  });

  test("drops the marker from ordered and nested items", () => {
    expect(render("1. [ ] One\n")).toContain("<li>One</li>");
    expect(render("- a\n  - [ ] b\n")).toContain("<li>b</li>");
  });

  test("drops the marker inside a callout", () => {
    const html = render("> [!TIP]\n> - [ ] Tip item\n");
    expect(html).toContain("markdown-alert-tip");
    expect(html).toContain("<li>Tip item</li>");
  });

  test("keeps formatting after the marker", () => {
    expect(render("- [ ] **b** c\n")).toContain(
      "<li><strong>b</strong> c</li>",
    );
  });

  test("leaves other brackets as text", () => {
    expect(render("- a [ ] b\n")).toContain("<li>a [ ] b</li>");
    expect(render("- `[ ]` c\n")).toContain("<code>[ ]</code>");
    expect(render("- [ ]\n")).toContain("[ ]");
    expect(render("[ ] x\n")).toContain("<p>[ ] x</p>");
    expect(render("- \\[ ] d\n")).toContain("<li>[ ] d</li>");
  });
});

describe("the build", () => {
  // The commit stands in for a tag, as in a development build.
  const ref = releaseRef(repoRoot, {});
  const build = () => {
    const outDir = join(tempDir("quest-pages-out-"), "pages");
    const result = buildPages({ root: repoRoot, ref, outDir, diagramsDir });
    return { outDir, ...result };
  };
  const first = build();

  test("passes both release tests on the real tree", () => {
    expect(first.problems).toEqual([]);
    expect(first.pages).toHaveLength(50);
  });

  test("gives identical bytes twice", () => {
    expect(tree(build().outDir)).toEqual(tree(first.outDir));
  });

  test("writes each page, each diagram in both themes, and the index", () => {
    const files = Object.keys(tree(first.outDir));
    expect(files.filter((f) => f.endsWith(".html"))).toHaveLength(50);
    expect(files.filter((f) => f.endsWith(".svg")).sort()).toEqual(
      [
        "advanced/02-orchestration-patterns",
        "intermediate/01-first-skill",
        "intermediate/05-hooks",
        "intermediate/06-subagents",
        "intermediate/07-mcp",
      ].flatMap((name) => [`/${name}.d1.dark.svg`, `/${name}.d1.light.svg`]),
    );
    const index = JSON.parse(
      readFileSync(join(first.outDir, "index.json"), "utf8"),
    ) as { ref: string; pages: { url: string; kind: string }[] };
    expect(index.ref).toBe(ref);
    expect(
      index.pages.find((p) => p.url === "/pages/intermediate/05-hooks.html")
        ?.kind,
    ).toBe("lesson");
  });

  test("ships the course with its example URLs at the ref and no indentation", () => {
    const dir = tempDir("quest-pages-course-");
    const from = join(repoRoot, "quest/engine/dist/course.json");
    const to = join(dir, "course.json");
    buildPages({
      root: repoRoot,
      ref,
      outDir: join(dir, "pages"),
      diagramsDir,
      course: { from, to },
    });
    const text = readFileSync(to, "utf8");
    expect(JSON.parse(text)).toEqual(
      JSON.parse(rewriteExampleUrls(readFileSync(from, "utf8"), ref)),
    );
    expect(text.trimEnd()).not.toContain("\n");
    expect(text.endsWith("\n")).toBe(true);
  });

  test("keeps every page under 100 KB", () => {
    for (const [file, body] of Object.entries(tree(first.outDir)))
      if (file.endsWith(".html"))
        expect(Buffer.from(body, "base64").length, file).toBeLessThan(
          100 * 1024,
        );
  });
});
