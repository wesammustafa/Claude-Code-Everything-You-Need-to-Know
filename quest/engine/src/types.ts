// The engine's own types (ticket 214): types and type imports only, so the
// import walks that read this file find no code in it.
import type { LessonId, LevelId } from "@quest/contract";
import type { LessonContent } from "./content.ts";

// A Lesson on the course's path, as the manifest places it: its level and
// page, and where it runs when that is not its level's work folder.
export interface PathEntry {
  id: LessonId;
  level: LevelId;
  page: string;
  // A later level's lesson pinned to the practice copy (i-capstone).
  folder?: "copy";
  // A lesson that runs in a new copy of the template (a-5, a-capstone).
  newCopy?: true;
  // A lesson of a level that practises in a work folder.
  work?: true;
}

// A Lesson of the course the engine plays: its path entry, its page's
// title, time estimate and links, its Check items, and its parsed steps
// (null with no step file). The course loader gives every field; a test's
// course may leave out the page's.
export interface CourseEntry {
  id: LessonId;
  level: LevelId;
  page?: string;
  minutes?: string;
  folder?: "copy";
  newCopy?: true;
  work?: true;
  title?: string;
  url?: string;
  stuck?: string;
  items: string[];
  slow?: number[];
  content?: LessonContent | null;
  // The compiled course's fingerprints (ticket 213); none for a step file
  // read on its own.
  fingerprint?: string;
  legacyFingerprint?: string;
}
