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
    {
      path: "docs/intermediate/README.md",
      url: "/pages/intermediate/README.html",
      title: "Intermediate",
      kind: "index",
      level: "intermediate",
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
<pre><code>a-long-command --that-runs-past-the-panel</code></pre>
<pre><code>short</code></pre>
<h2 id="check">Check</h2>
<ul><li>[ ] shown as the release rendered it</li></ul>`,
  "/pages/intermediate/README.html": `<h1 id="intermediate">Intermediate</h1><p>The Level.</p>`,
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

// The release renderer drops task-list markers (279); the panel shows a
// page's text exactly as rendered and edits none of it.
test("shows list text as the release rendered it", async () => {
  await openPage();
  await heading("Install and look around");
  expect(
    screen.getByRole("listitem", {
      name: (_, el) =>
        el.textContent === "[ ] shown as the release rendered it",
    }),
  ).toBeInTheDocument();
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

// jsdom lays nothing out, so each code block's widths and the
// ResizeObserver are stand-ins: the long block starts wider than the page.
test("a code block wider than the page is a named tab stop, until a resize lets it fit", async () => {
  const wide = new Set<string>(["a-long-command --that-runs-past-the-panel"]);
  const widths = (el: HTMLElement) =>
    el.tagName === "PRE" && wide.has(el.textContent) ? 900 : 400;
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return widths(this);
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
  type Changed = (entries: { target: Element }[]) => void;
  // Every observer (the Panel's own too), each with what it watches.
  const observers: { changed: Changed; watched: Element[] }[] = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      private own: { changed: Changed; watched: Element[] };
      constructor(changed: Changed) {
        this.own = { changed, watched: [] };
        observers.push(this.own);
      }
      observe(el: Element) {
        this.own.watched.push(el);
      }
      disconnect() {
        this.own.watched = [];
      }
    },
  );
  const observed = () => observers.flatMap((o) => o.watched);
  try {
    await openPage();
    await heading("Install and look around");
    const long = screen.getByRole("group", { name: "Code block" });
    expect(long).toHaveTextContent("a-long-command");
    expect(long.tagName).toBe("PRE");
    expect(long).toHaveAttribute("tabindex", "0");
    const short = screen.getByText("short").closest("pre");
    expect(short).not.toHaveAttribute("tabindex");
    expect(short).not.toHaveAttribute("role");
    expect(observed()).toContain(long);

    wide.clear();
    act(() => {
      for (const { changed, watched } of observers)
        changed(watched.map((target) => ({ target })));
    });
    expect(screen.queryByRole("group", { name: "Code block" })).toBeNull();
    expect(long).not.toHaveAttribute("tabindex");
    expect(long).not.toHaveAttribute("aria-label");
  } finally {
    vi.restoreAllMocks();
  }
});

// The code font loads lazily and widens a block without resizing its box,
// so a font that finishes loading marks every block again.
test("a font that finishes loading marks a block that now runs past the page", async () => {
  const wide = new Set<string>();
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "PRE" && wide.has(this.textContent) ? 900 : 400;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
  const fonts = Object.assign(new EventTarget(), {
    ready: Promise.resolve(),
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fonts,
  });
  try {
    await openPage();
    await heading("Install and look around");
    expect(screen.queryByRole("group", { name: "Code block" })).toBeNull();
    wide.add("short");
    act(() => {
      fonts.dispatchEvent(new Event("loadingdone"));
    });
    const short = screen.getByRole("group", { name: "Code block" });
    expect(short).toHaveTextContent("short");
    expect(short).toHaveAttribute("tabindex", "0");
  } finally {
    Reflect.deleteProperty(document, "fonts");
    vi.restoreAllMocks();
  }
});

// A focused block that stops running past the page keeps its stop until
// focus leaves it, so focus never drops out of the panel.
test("a focused code block that comes to fit keeps its tab stop until focus leaves", async () => {
  const wide = new Set<string>(["short"]);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.tagName === "PRE" && wide.has(this.textContent) ? 900 : 400;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
  const fonts = Object.assign(new EventTarget(), {
    ready: Promise.resolve(),
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fonts,
  });
  try {
    const user = await openPage();
    await heading("Install and look around");
    const short = screen.getByRole("group", { name: "Code block" });
    act(() => {
      short.focus();
    });
    wide.clear();
    act(() => {
      fonts.dispatchEvent(new Event("loadingdone"));
    });
    expect(short).toHaveFocus();
    expect(short).toHaveAttribute("tabindex", "0");
    await user.tab();
    expect(short).not.toHaveFocus();
    expect(short).not.toHaveAttribute("tabindex");
    expect(short).not.toHaveAttribute("role");
  } finally {
    Reflect.deleteProperty(document, "fonts");
    vi.restoreAllMocks();
  }
});

test("a page that did not load offers Retry and GitHub", async () => {
  failing.add("/pages/beginner/01-a.html");
  const user = await openPage();
  expect(await screen.findByText("This page did not load.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Open on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/wesammustafa/Claude-Code-Quest/blob/v2026.11/docs/beginner/01-a.md",
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
    "https://github.com/wesammustafa/Claude-Code-Quest/issues/new?template=lesson-feedback.yml&lesson=b-1",
  );
  await user.click(screen.getByRole("link", { name: "Commands" }));
  await heading("Commands by level");
  expect(
    screen.queryByRole("link", { name: "Stuck on this lesson? Tell us" }),
  ).toBeNull();
});

test("a Level index page's feedback link names the active Lesson", async () => {
  await openPage("docs/intermediate/README.md");
  await heading("Intermediate");
  expect(
    screen.getByRole("link", { name: "Stuck on this lesson? Tell us" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/wesammustafa/Claude-Code-Quest/issues/new?template=lesson-feedback.yml&lesson=b-2",
  );
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
