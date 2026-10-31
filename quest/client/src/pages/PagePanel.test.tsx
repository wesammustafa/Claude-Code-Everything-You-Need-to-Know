import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resetPageCache, type PageIndex } from "./fetch";
import { PagePanelProvider, usePagePanel } from "./PagePanel";

const tellPip = vi.fn();
vi.mock("../pip/PipStage", () => ({ usePipInput: () => tellPip }));
vi.mock("../screens/lesson", () => ({
  useCourseSnapshot: () => ({
    lesson: { id: "b-2" },
    course: {
      levels: [
        {
          lessons: [
            { id: "b-1", page: "docs/beginner/01-a.md" },
            { id: "b-2", page: "docs/beginner/02-b.md" },
          ],
        },
      ],
    },
  }),
}));

const INDEX: PageIndex = {
  ref: "v2026.11",
  pages: [
    {
      path: "docs/beginner/01-a.md",
      url: "/pages/beginner/01-a.html",
      title: "Install and look around",
      kind: "lesson",
      level: "beginner",
    },
    {
      path: "docs/reference/commands.md",
      url: "/pages/reference/commands.html",
      title: "Commands by level",
      kind: "reference",
    },
  ],
};

const BLOB = "https://github.com/x/blob/v2026.11";
const PAGES: Record<string, string> = {
  "/pages/beginner/01-a.html": `<h1 id="install">Install and look around</h1>
<p><a href="#check">Jump to the check</a></p>
<p><a href="${BLOB}/docs/reference/commands.md" data-page="docs/reference/commands.md">Commands</a></p>
<p><a href="${BLOB}/docs/beginner/README.md">The README</a></p>
<p><a href="${BLOB}/docs/topics/x.md" data-page="docs/topics/x.md">Not rendered</a></p>
<picture class="diagram" data-light="/pages/d.light.svg" data-dark="/pages/d.dark.svg"><source media="(prefers-color-scheme: dark)" srcset="/pages/d.dark.svg" /><img src="/pages/d.light.svg" alt="A diagram" /></picture>
<ul><li>[ ] Self-check one</li><li>[x] Self-check two</li></ul>
<h2 id="check">Check</h2>`,
  "/pages/reference/commands.html": `<h1 id="commands">Commands by level</h1><p>Every command.</p>`,
};

let failing = new Set<string>();
let fetches: string[];
const scrolled = vi.fn();

beforeEach(() => {
  resetPageCache();
  tellPip.mockClear();
  failing = new Set();
  fetches = [];
  scrolled.mockClear();
  // jsdom lays nothing out, so has no scrollIntoView.
  Element.prototype.scrollIntoView = scrolled;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      fetches.push(url);
      const html = PAGES[url];
      return Promise.resolve(
        failing.has(url)
          ? new Response("", { status: 500 })
          : url === "/pages/index.json"
            ? Response.json(INDEX)
            : html === undefined
              ? new Response("", { status: 404 })
              : new Response(html),
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  delete document.documentElement.dataset.theme;
});

function Opener({ path }: { path: string }) {
  const { open } = usePagePanel();
  return (
    <button
      type="button"
      onClick={() => {
        open(path);
      }}
    >
      Read the full lesson
    </button>
  );
}

async function openPage(path = "docs/beginner/01-a.md") {
  const user = userEvent.setup();
  render(
    <PagePanelProvider>
      <Opener path={path} />
    </PagePanelProvider>,
  );
  expect(fetches).toEqual([]);
  await user.click(
    screen.getByRole("button", { name: "Read the full lesson" }),
  );
  return user;
}

const heading = (name: string) =>
  screen.findByRole("heading", { level: 1, name });

test("fetches nothing until opened, then the index and the one page", async () => {
  await openPage();
  expect(
    await screen.findByRole("dialog", { name: "Install and look around" }),
  ).toBeVisible();
  expect(fetches).toEqual(["/pages/index.json", "/pages/beginner/01-a.html"]);
});

test("a heading link scrolls inside the page, focuses the heading and leaves the hash", async () => {
  const user = await openPage();
  await heading("Install and look around");
  const before = window.location.hash;
  await user.click(screen.getByRole("link", { name: "Jump to the check" }));
  const target = screen.getByRole("heading", { name: "Check" });
  expect(scrolled.mock.contexts).toContain(target);
  expect(target).toHaveFocus();
  expect(window.location.hash).toBe(before);
});

test("a link to a rendered page shows it in place, and Back returns", async () => {
  const user = await openPage();
  await heading("Install and look around");
  await user.click(screen.getByRole("link", { name: "Commands" }));
  expect(await heading("Commands by level")).toHaveFocus();
  expect(
    screen.getByRole("dialog", { name: "Commands by level" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(await heading("Install and look around")).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

test("a page link the release did not render keeps its link, and every other link opens a new tab", async () => {
  await openPage();
  await heading("Install and look around");
  const missing = screen.getByRole("link", { name: "Not rendered" });
  expect(missing).toHaveAttribute("href", `${BLOB}/docs/topics/x.md`);
  for (const name of ["Not rendered", "The README"]) {
    const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(
    screen.getByRole("link", { name: "Jump to the check" }),
  ).not.toHaveAttribute("target");
});

test("the diagram follows data-theme", async () => {
  await openPage();
  await heading("Install and look around");
  const img = screen.getByRole("img", { name: "A diagram" });
  expect(img).toHaveAttribute("src", "/pages/d.light.svg");
  await act(async () => {
    document.documentElement.dataset.theme = "dark";
    await Promise.resolve();
  });
  expect(img).toHaveAttribute("src", "/pages/d.dark.svg");
  expect(img.parentElement?.querySelector("source")).toHaveAttribute(
    "srcset",
    "/pages/d.dark.svg",
  );
});

test("a self-check list shows no [ ] text", async () => {
  await openPage();
  await heading("Install and look around");
  expect(screen.getByText("Self-check one").textContent).toBe("Self-check one");
  expect(screen.getByText("Self-check two")).toBeInTheDocument();
  expect(screen.queryByText(/\[ \]/)).toBeNull();
});

test("a page that did not load offers Retry and GitHub", async () => {
  failing.add("/pages/beginner/01-a.html");
  const user = await openPage();
  expect(await screen.findByText("This page did not load.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Open on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/v2026.11/docs/beginner/01-a.md",
  );
  failing.clear();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await heading("Install and look around")).toBeVisible();
});

test("a lesson page ends with the feedback link for the Lesson it belongs to, not the active one; a reference page has none", async () => {
  const user = await openPage();
  await heading("Install and look around");
  expect(
    screen.getByRole("link", { name: "Stuck on this lesson? Tell us" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-1",
  );
  await user.click(screen.getByRole("link", { name: "Commands" }));
  await heading("Commands by level");
  expect(
    screen.queryByRole("link", { name: "Stuck on this lesson? Tell us" }),
  ).toBeNull();
});

test("Pip rests while open; Escape closes and focus returns to the opener", async () => {
  const user = await openPage();
  await heading("Install and look around");
  expect(tellPip).toHaveBeenCalledWith({ type: "pagePanel", open: true });
  tellPip.mockClear();
  await user.keyboard("{Escape}");
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(tellPip).toHaveBeenCalledWith({ type: "pagePanel", open: false });
  expect(
    screen.getByRole("button", { name: "Read the full lesson" }),
  ).toHaveFocus();
});
