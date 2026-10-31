import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "../components/Button";
import { Panel } from "../components/Panel";
import { motionReduced, useResolvedTheme, type Theme } from "../lib/page";
import { usePipInput } from "../pip/PipStage";
import { useCourseSnapshot } from "../screens/lesson";
import {
  entryFor,
  githubBlob,
  GUIDE_REPO,
  pageHtml,
  pageIndex,
  type PageEntry,
  type PageIndex,
} from "./fetch";

/** A page to show: its repository path, and the heading to scroll to. */
interface Opened {
  path: string;
  fragment?: string;
}

interface PagePanelValue {
  /** Opens the rendered page at this repository path, at `fragment` if given. */
  open: (path: string, fragment?: string) => void;
}

const PagePanelContext = createContext<PagePanelValue>({
  open: () => undefined,
});

export function usePagePanel(): PagePanelValue {
  return useContext(PagePanelContext);
}

type Loaded =
  | { state: "loading" }
  | { state: "failed"; key: string; ref: string }
  | {
      state: "ready";
      key: string;
      entry: PageEntry;
      html: string;
      index: PageIndex;
    };

/**
 * The page at `opened`, fetched when asked for; `retry` asks again. An
 * answer counts only for the request it answers (its `key`).
 */
function usePage(opened: Opened | undefined): {
  loaded: Loaded;
  retry: () => void;
} {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [tries, setTries] = useState(0);
  const path = opened?.path;
  useEffect(() => {
    if (path === undefined) return;
    let current = true;
    const key = `${path}#${String(tries)}`;
    pageIndex().then(
      (index) => {
        const entry = entryFor(index, path);
        if (!entry) {
          if (current) setLoaded({ state: "failed", key, ref: index.ref });
          return;
        }
        pageHtml(entry.url).then(
          (html) => {
            if (current) setLoaded({ state: "ready", key, entry, html, index });
          },
          () => {
            if (current) setLoaded({ state: "failed", key, ref: index.ref });
          },
        );
      },
      () => {
        if (current) setLoaded({ state: "failed", key, ref: "main" });
      },
    );
    return () => {
      current = false;
    };
  }, [path, tries]);
  const retry = useCallback(() => {
    setTries((n) => n + 1);
  }, []);
  const asked = path === undefined ? null : `${path}#${String(tries)}`;
  // An answer to an earlier request (the page before a swap, or before a
  // Retry) counts as still loading.
  return {
    loaded:
      loaded.state !== "loading" && loaded.key === asked
        ? loaded
        : { state: "loading" },
    retry,
  };
}

const TASK = /^\[[ xX]\] /;

/** Drops the `[ ] ` a self-check list item starts with: the list shows no boxes. */
function stripTaskMarkers(root: HTMLElement): void {
  for (const item of root.querySelectorAll("li")) {
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first?.nodeValue && TASK.test(first.nodeValue))
      first.nodeValue = first.nodeValue.replace(TASK, "");
  }
}

/** Shows each diagram drawn for `theme`, whatever the system theme is. */
function paintDiagrams(root: HTMLElement, theme: Theme): void {
  for (const picture of root.querySelectorAll<HTMLElement>("picture.diagram")) {
    const url = picture.dataset[theme];
    if (url === undefined) continue;
    for (const source of picture.querySelectorAll("source"))
      source.srcset = url;
    const img = picture.querySelector("img");
    if (img) img.src = url;
  }
}

function byId(root: HTMLElement, id: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>("[id]"))
    if (el.id === id) return el;
  return null;
}

/** Scrolls to `target` inside the panel and moves focus there, without touching the address. */
function goTo(target: HTMLElement): void {
  target.scrollIntoView({
    behavior: motionReduced() ? "auto" : "smooth",
    block: "start",
  });
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

function PageBody({
  entry,
  html,
  opened,
  swapped,
  onPage,
}: {
  entry: PageEntry;
  html: string;
  opened: Opened;
  /** Shown in place of another page, so focus moves to its heading. */
  swapped: boolean;
  onPage: (path: string, fragment?: string) => boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const theme = useResolvedTheme();
  const onPageRef = useRef(onPage);
  useEffect(() => {
    onPageRef.current = onPage;
  }, [onPage]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    stripTaskMarkers(el);
    for (const link of el.querySelectorAll("a[href]")) {
      if (link.getAttribute("href")?.startsWith("#")) continue;
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
    const heading = el.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    const body = el.closest<HTMLElement>("[data-panel-body]");
    const target =
      opened.fragment === undefined ? null : byId(el, opened.fragment);
    if (target) goTo(target);
    else {
      if (body) body.scrollTop = 0;
      if (swapped) heading?.focus({ preventScroll: true });
    }
  }, [html, opened, swapped]);

  useLayoutEffect(() => {
    if (root.current) paintDiagrams(root.current, theme);
  }, [html, theme]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link || !el.contains(link)) return;
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        event.preventDefault();
        const target = byId(el, decodeURIComponent(href.slice(1)));
        if (target) goTo(target);
        return;
      }
      if (!(link instanceof HTMLElement) || link.dataset.page === undefined)
        return;
      if (onPageRef.current(link.dataset.page, link.dataset.fragment))
        event.preventDefault();
    };
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div
      ref={root}
      data-page-path={entry.path}
      className="page-prose max-w-measure"
      // The fragment comes from the release build, which sanitizes it
      // (quest/release, 223), and the app's CSP allows no inline script.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * The page panel, one for the whole app: a rendered Guide page in the wide
 * Panel, fetched when first opened. A link to another bundled page shows it
 * here in place, with Back to return; a heading link scrolls the panel;
 * every other link opens on GitHub in a new tab. Pip rests while it is open.
 */
export function PagePanelProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Opened[]>([]);
  const opened = history.at(-1);
  const { loaded, retry } = usePage(opened);
  const snapshot = useCourseSnapshot();
  const tellPip = usePipInput();
  const isOpen = opened !== undefined;
  // How many swaps there have been since the panel opened.
  const [swaps, setSwaps] = useState(0);

  useEffect(() => {
    tellPip({ type: "pagePanel", open: isOpen });
  }, [tellPip, isOpen]);
  useEffect(
    () => () => {
      tellPip({ type: "pagePanel", open: false });
    },
    [tellPip],
  );

  const open = useCallback((path: string, fragment?: string) => {
    setSwaps(0);
    setHistory([{ path, ...(fragment === undefined ? {} : { fragment }) }]);
  }, []);
  const close = useCallback(() => {
    setHistory([]);
  }, []);
  const back = () => {
    setSwaps((n) => n + 1);
    setHistory((list) => list.slice(0, -1));
  };
  const index = loaded.state === "ready" ? loaded.index : null;
  const onPage = useCallback(
    (path: string, fragment?: string): boolean => {
      // Only a page the release rendered shows here; any other keeps its link.
      if (!index || !entryFor(index, path)) return false;
      setSwaps((n) => n + 1);
      setHistory((list) => [
        ...list,
        { path, ...(fragment === undefined ? {} : { fragment }) },
      ]);
      return true;
    },
    [index],
  );
  const value = useMemo(() => ({ open }), [open]);

  // Feedback names the Lesson whose page is shown, which after a link swap
  // or on a warm-up's recalled page is not the active one.
  const shownPath = loaded.state === "ready" ? loaded.entry.path : undefined;
  const lessonId = snapshot?.course.levels
    .flatMap((level) => level.lessons)
    .find((summary) => summary.page === shownPath)?.id;
  const feedback =
    loaded.state === "ready" &&
    lessonId !== undefined &&
    (loaded.entry.kind === "lesson" || loaded.entry.kind === "capstone");

  return (
    <PagePanelContext.Provider value={value}>
      {children}
      <Panel
        title={loaded.state === "ready" ? loaded.entry.title : "Lesson page"}
        wide
        open={isOpen}
        onClose={close}
      >
        {history.length > 1 && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={back}>
            Back
          </Button>
        )}
        {opened && loaded.state === "ready" && (
          <PageBody
            key={`${String(history.length)}:${opened.path}`}
            entry={loaded.entry}
            html={loaded.html}
            opened={opened}
            swapped={swaps > 0}
            onPage={onPage}
          />
        )}
        {isOpen && loaded.state === "loading" && (
          <p className="text-sm text-muted" aria-busy="true">
            Loading the page.
          </p>
        )}
        {opened && loaded.state === "failed" && (
          <div className="grid justify-items-start gap-3">
            <p className="text-sm text-muted">This page did not load.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={retry}>
                Retry
              </Button>
              <a
                href={githubBlob(loaded.ref, opened.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm"
              >
                Open on GitHub
              </a>
            </div>
          </div>
        )}
        {feedback && (
          <p className="max-w-measure border-t border-line pt-4 text-sm text-muted">
            <a
              href={`${GUIDE_REPO}/issues/new?template=lesson-feedback.yml&lesson=${encodeURIComponent(lessonId)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Stuck on this lesson? Tell us
            </a>
          </p>
        )}
      </Panel>
    </PagePanelContext.Provider>
  );
}
