import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { renderWithMotion } from "../../test/motion";
import { expectStylesFromTokens } from "../../test/token-classes";
import { NEW_BADGE } from "./Badge";
import {
  BADGE_SYMBOLS,
  LessonBadge,
  type LessonId,
  type RegularLessonId,
} from "./badges";

const steps = import.meta.glob<string>("../../../../course/steps/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const manifestText = import.meta.glob<string>(
  "../../../../course/manifest.json",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);
const manifest = JSON.parse(Object.values(manifestText)[0] ?? "{}") as {
  lessons: { id: string; level: string }[];
};

// Each step file's front matter, by key name.
const frontMatter = (text: string) =>
  new Map(
    (/^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "")
      .split("\n")
      .map((line) => /^(\w+):\s*(.*)$/.exec(line))
      .filter((m) => m !== null)
      .map((m) => [m[1] ?? "", (m[2] ?? "").replace(/^"(.*)"$/, "$1")]),
  );

const BADGES = Object.values(steps)
  .map(frontMatter)
  .map((fm) => ({ id: fm.get("lesson") ?? "", name: fm.get("badge") ?? "" }))
  .sort((a, b) => a.id.localeCompare(b.id));

const REGULAR = Object.keys(BADGE_SYMBOLS) as RegularLessonId[];
const IDS: LessonId[] = [...REGULAR, "b-capstone", "i-capstone", "a-capstone"];
const SHAPE_OF_LEVEL: Record<string, string> = {
  beginner: "circle",
  intermediate: "hexagon",
  advanced: "shield",
};

describe("the step files and the Badge table agree", () => {
  test("the same 23 Lessons as the manifest", () => {
    expect(BADGES).toHaveLength(23);
    const ids = BADGES.map((b) => b.id);
    expect(ids).toEqual([...IDS].sort((a, b) => a.localeCompare(b)));
    expect(manifest.lessons.map((l) => l.id).sort()).toEqual([...ids].sort());
  });

  test("the names are unique, present and keep the copy rules", () => {
    const names = BADGES.map((b) => b.name);
    expect(new Set(names).size).toBe(23);
    for (const name of names) {
      expect(name).not.toBe("");
      expect(name).not.toMatch(/key|press|stuck|wrong|fail|locked/i);
      expect(name).not.toContain(String.fromCodePoint(0x2014));
    }
  });

  test.each(manifest.lessons)(
    "$id takes its Level's shape",
    ({ id, level }) => {
      const { container } = renderWithMotion(
        <LessonBadge lesson={id} name="Name" earned caption={false} />,
      );
      const shape = container.querySelector("[data-badge-shape] > g > *");
      const expected = SHAPE_OF_LEVEL[level];
      if (expected === "circle") expect(shape?.tagName).toBe("circle");
      else
        expect(shape?.getAttribute("d")).toBe(
          expected === "hexagon"
            ? "M32 6.5 54 19.2v25.6L32 57.5 10 44.8V19.2z"
            : "M32 6 53 13.5v17.2C53 44 44.2 53.4 32 58 19.8 53.4 11 44 11 30.7V13.5z",
        );
    },
  );
});

const STAR_D = "m12 3.5 2.6 5.3";

describe.each(BADGES)("$name ($id)", ({ id, name }) => {
  const capstone = id.endsWith("-capstone");
  test.each([
    [true, "xs"],
    [true, "sm"],
    [true, "xl"],
    [false, "xs"],
    [false, "sm"],
    [false, "xl"],
  ] as const)("earned %s at %s", (earned, size) => {
    const { container } = renderWithMotion(
      <LessonBadge lesson={id} name={name} earned={earned} size={size} />,
    );
    const badge = screen.getByRole("img", {
      name: earned ? name : `${name}, not yet`,
    });
    expect(badge).toHaveClass(earned ? "text-accent-mark" : "text-mark");
    expect(badge.querySelector("[stroke-dasharray]") !== null).toBe(!earned);
    expect(badge.querySelector("[transform*='scale(.78)']") !== null).toBe(
      capstone,
    );
    const symbol = badge.querySelector("[transform='translate(20 20)']");
    expect(symbol).not.toBeNull();
    expect(symbol?.innerHTML.includes(STAR_D)).toBe(capstone);
    expect(symbol).toHaveAttribute(
      "stroke-width",
      size === "xs" ? "2.6" : "1.8",
    );
    const caption = container.querySelector("figcaption");
    expect(caption).toHaveAttribute("aria-hidden", "true");
    expect(caption?.textContent).toBe(earned ? name : `${name}Not yet`);
    expect(container.innerHTML).not.toMatch(/lock/i);
    expectStylesFromTokens(badge.getAttribute("class") ?? "");
    for (const el of container.querySelectorAll("figcaption, figcaption *"))
      expectStylesFromTokens(el.getAttribute("class") ?? "");
  });

  // An unearned Badge is the earned art with a dashed outline and nothing
  // added, so no lock or other mark can creep onto it.
  test("unearned draws the same symbol as earned", () => {
    const symbolOf = (earned: boolean) => {
      const { container, unmount } = renderWithMotion(
        <LessonBadge lesson={id} name={name} earned={earned} caption={false} />,
      );
      const html = container.querySelector(
        "[transform='translate(20 20)']",
      )?.outerHTML;
      const paths = container.querySelectorAll(
        "path, rect, circle, polygon",
      ).length;
      unmount();
      return { html, paths };
    };
    expect(symbolOf(false)).toEqual(symbolOf(true));
  });
});

test("without its caption, only the image", () => {
  const { container } = renderWithMotion(
    <LessonBadge lesson="b-1" name="Explorer" earned={false} caption={false} />,
  );
  expect(container.querySelector("figure")).toBeNull();
  expect(screen.queryByText("Not yet")).toBeNull();
  expect(screen.getByRole("img", { name: "Explorer, not yet" })).toBeVisible();
});

test("revealed, it shows a visible New badge line, caption or not", () => {
  renderWithMotion(
    <LessonBadge
      lesson="i-capstone"
      name="Intermediate"
      earned
      size="xl"
      reveal
      caption={false}
    />,
  );
  expect(screen.getByText(NEW_BADGE)).toBeVisible();
  expect(screen.getByText("Intermediate")).toBeVisible();
  expect(screen.getByRole("img", { name: "Intermediate" })).toHaveClass(
    "size-28",
  );
});

test("with no name, nothing to show", () => {
  const { container } = renderWithMotion(
    <LessonBadge lesson="b-1" name={null} earned />,
  );
  expect(container).toBeEmptyDOMElement();
});

test.each([
  ["i-9", "hexagon"],
  ["a-capstone-2", "shield"],
  ["z-1", "circle"],
  ["", "circle"],
])("an unknown id %j still shows a %s, with no symbol", (lesson, shape) => {
  renderWithMotion(<LessonBadge lesson={lesson} name="Someday" earned />);
  const badge = screen.getByRole("img", { name: "Someday" });
  expect(badge.querySelector("[transform='translate(20 20)']")).toBeNull();
  const drawn = badge.querySelector("[data-badge-shape] > g > *");
  expect(drawn?.tagName).toBe(shape === "circle" ? "circle" : "path");
});
