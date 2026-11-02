import { Button, type ButtonVariant } from "../components/Button";
import { useOpenLesson } from "./lesson";

// The Journey and Progress button that opens a Lesson through useOpenLesson.
export function OpenLessonButton({
  id,
  variant,
  children,
}: {
  id: string;
  variant?: ButtonVariant;
  children: string;
}) {
  const open = useOpenLesson(id);
  return (
    <Button variant={variant} iconEnd="arrow" {...open}>
      {children}
    </Button>
  );
}
