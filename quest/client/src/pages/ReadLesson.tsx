import { useState } from "react";
import { Button, buttonClasses, type ButtonSize } from "../components/Button";
import { Icon } from "../components/Icon";
import { cx } from "../lib/cx";
import { useCourseSnapshot } from "../screens/lesson";
import { githubBlob, pageIndex } from "./fetch";
import { lessonPageOf } from "./lesson-page";
import { usePagePanel } from "./PagePanel";

/**
 * "Read the full lesson": the page panel on the Lesson's page (the recalled
 * Lesson's during its warm-up), or, for a Level index warm-up, the Level's
 * README on GitHub at the release ref in a new tab.
 */
export function ReadLesson({
  size = "md",
  className,
}: {
  size?: ButtonSize;
  className?: string;
}) {
  const target = lessonPageOf(useCourseSnapshot());
  const { open } = usePagePanel();
  if (!target) return null;
  if ("page" in target)
    return (
      <Button
        variant="ghost"
        size={size}
        icon="book"
        aria-haspopup="dialog"
        className={className}
        onClick={() => {
          open(target.page);
        }}
      >
        Read the full lesson
      </Button>
    );
  return <GithubLink size={size} className={className} path={target.github} />;
}

// The ref is in the page index, which loads only when asked for: the link
// names main until then. Pointing at or focusing the link asks for it, and
// the href swaps to the ref; the click stays a plain link, so the browser
// opens it as a user action and modifier clicks keep working.
function GithubLink({
  size,
  className,
  path,
}: {
  size: ButtonSize;
  className: string | undefined;
  path: string;
}) {
  const [ref, setRef] = useState("main");
  const load = () => {
    pageIndex().then(
      (index) => {
        setRef(index.ref);
      },
      () => undefined,
    );
  };
  return (
    <a
      href={githubBlob(ref, path)}
      target="_blank"
      rel="noopener noreferrer"
      onPointerEnter={load}
      onFocus={load}
      className={cx(
        "group no-underline",
        buttonClasses("ghost", size, "link"),
        className,
      )}
    >
      <Icon name="book" size={size === "lg" ? "lg" : "md"} />
      <span>Read the full lesson</span>
    </a>
  );
}
