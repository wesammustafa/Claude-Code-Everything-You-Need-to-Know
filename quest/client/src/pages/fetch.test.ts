import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  entryFor,
  githubBlob,
  GUIDE_REPO,
  pageHtml,
  pageIndex,
  resetPageCache,
  type PageIndex,
} from "./fetch";

const INDEX: PageIndex = {
  ref: "v2026.11",
  pages: [
    {
      path: "docs/beginner/01-install-and-look-around.md",
      url: "/pages/beginner/01-install-and-look-around.html",
      title: "Install",
      kind: "lesson",
      level: "beginner",
    },
  ],
};

let answers: (() => Response)[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetPageCache();
  answers = [];
  fetchMock = vi.fn(() => {
    const answer = answers.shift();
    return Promise.resolve(
      answer ? answer() : new Response("nope", { status: 500 }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pageIndex", () => {
  test("asks once, however often it is called", async () => {
    answers.push(() => Response.json(INDEX));
    const [a, b] = await Promise.all([pageIndex(), pageIndex()]);
    expect(a).toEqual(INDEX);
    expect(b).toBe(a);
    expect(await pageIndex()).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/pages/index.json");
  });

  test("asks again after a failure", async () => {
    answers.push(() => new Response("", { status: 503 }));
    await expect(pageIndex()).rejects.toThrow(/503/);
    answers.push(() => Response.json(INDEX));
    expect(await pageIndex()).toEqual(INDEX);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("pageHtml", () => {
  test("asks once per URL", async () => {
    answers.push(
      () => new Response("<h1>A</h1>"),
      () => new Response("<h1>B</h1>"),
    );
    expect(await pageHtml("/pages/a.html")).toBe("<h1>A</h1>");
    expect(await pageHtml("/pages/a.html")).toBe("<h1>A</h1>");
    expect(await pageHtml("/pages/b.html")).toBe("<h1>B</h1>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("asks again after a failure", async () => {
    answers.push(() => new Response("", { status: 404 }));
    await expect(pageHtml("/pages/a.html")).rejects.toThrow(/404/);
    answers.push(() => new Response("<h1>A</h1>"));
    expect(await pageHtml("/pages/a.html")).toBe("<h1>A</h1>");
  });
});

test("entryFor finds a page by its repository path", () => {
  expect(entryFor(INDEX, "docs/beginner/01-install-and-look-around.md")).toBe(
    INDEX.pages[0],
  );
  expect(entryFor(INDEX, "docs/nope.md")).toBeUndefined();
});

test("githubBlob links the file at the ref", () => {
  expect(githubBlob("v2026.11", "docs/beginner/README.md")).toBe(
    `${GUIDE_REPO}/blob/v2026.11/docs/beginner/README.md`,
  );
});
