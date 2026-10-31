import { Button, type ButtonSize } from "../components/Button";
import { useCourseSnapshot } from "../screens/lesson";
import { lessonPageOf } from "./lesson-page";
import { usePagePanel } from "./PagePanel";

/**
 * "Read the full lesson": the page panel on the Lesson's page (the recalled
 * Lesson's during its warm-up, or the Level's README for a Level index
 * warm-up).
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
}
