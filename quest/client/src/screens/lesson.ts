import { useParams } from "react-router";
import { findLesson, type LessonInfo } from "../course/placeholder";

/** The Lesson the route names, or undefined for an unknown id. */
export function useLesson(): LessonInfo | undefined {
  return findLesson(useParams().lessonId);
}
