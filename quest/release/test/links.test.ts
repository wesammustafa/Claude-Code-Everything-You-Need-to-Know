// Where links in a rendered page go, and the release test on links: on the
// real tree it passes, on a planted fixture it names the bad links.
import { afterAll, describe, expect, test } from "vitest";
import { REPO_URL, buildPages, rewriteHref } from "../src/pages.mjs";
import {
  diagramsDir,
  plantedRepo,
  realContext,
  removeTemp,
  tempDir,
} from "./pages-fixture";

afterAll(removeTemp);

const ctx = realContext("v1");
const from = "docs/intermediate/05-hooks.md";
const at = (href: string) => rewriteHref(from, href, ctx);

describe("rewriteHref", () => {
  test("a heading on the same page stays", () => {
    expect(at("#worked-example")).toEqual({
      href: "#worked-example",
      attrs: {},
      path: null,
      kind: "same-page",
    });
  });

  test.each([
    "https://code.claude.com/docs",
    "mailto:a@b.c",
    "//cdn.example/x",
  ])("%s stays as written", (href) => {
    expect(at(href)).toMatchObject({ href, kind: "external" });
  });

  test("a live page links to GitHub and names itself for the panel", () => {
    expect(at("06-subagents.md#the-idea")).toEqual({
      href: `${REPO_URL}/blob/v1/docs/intermediate/06-subagents.md#the-idea`,
      attrs: {
        "data-page": "docs/intermediate/06-subagents.md",
        "data-fragment": "the-idea",
      },
      path: "docs/intermediate/06-subagents.md",
      kind: "page",
    });
    expect(at("/docs/beginner/capstone.md").attrs).toEqual({
      "data-page": "docs/beginner/capstone.md",
    });
  });

  test("a Stub, a README, a file and a folder open on GitHub at the ref", () => {
    expect(at("../skills.md")).toMatchObject({
      href: `${REPO_URL}/blob/v1/docs/skills.md`,
      kind: "stub",
      attrs: {},
    });
    expect(at("README.md").kind).toBe("readme");
    expect(at("../../examples/intermediate/05-hooks/README.md").kind).toBe(
      "readme",
    );
    expect(at("../missing/README.md").kind).toBe("missing");
    expect(at("../../package.json")).toMatchObject({
      href: `${REPO_URL}/blob/v1/package.json`,
      kind: "file",
    });
    expect(at("../../examples/intermediate/05-hooks/")).toMatchObject({
      href: `${REPO_URL}/tree/v1/examples/intermediate/05-hooks`,
      kind: "folder",
    });
  });
});

test("a malformed percent-escape stays as written instead of throwing", () => {
  expect(at("06-subagents.md#%E0%A4%A").attrs).toEqual({
    "data-page": "docs/intermediate/06-subagents.md",
    "data-fragment": "%E0%A4%A",
  });
  expect(at("%E0%A4%A.md").kind).toBe("missing");
});

describe("the release test on links", () => {
  test("names a link to an unbundled page and to a missing one", () => {
    const root = plantedRepo("planted-bad-link");
    const { problems } = buildPages({
      root,
      ref: "v0000.00",
      outDir: tempDir("quest-pages-out-"),
      diagramsDir,
    });
    expect(problems).toEqual([
      "docs/beginner/01-start.md:3: ../adr/0001-decision.md points into docs/ at docs/adr/0001-decision.md, which is not a bundled page or a Stub",
      "docs/beginner/01-start.md:3: 02-gone.md points into docs/ at docs/beginner/02-gone.md, which is not a bundled page or a Stub",
    ]);
  });
});
