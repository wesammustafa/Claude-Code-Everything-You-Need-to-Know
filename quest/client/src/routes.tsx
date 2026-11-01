import type { RouteObject } from "react-router";
import { Journey } from "./screens/Journey";
import { LessonComplete } from "./screens/LessonComplete";
import { LessonOverview } from "./screens/LessonOverview";
import { NotFound } from "./screens/NotFound";
import { Progress } from "./screens/Progress";
import { Welcome } from "./screens/Welcome";
import { Workspace } from "./screens/Workspace";
import { Shell } from "./shell/Shell";

/**
 * Development-only routes: the Pip Playground, where Pip is reviewed and
 * approved (`npm run dev`, then /#/playground). The release build replaces
 * `import.meta.env.DEV` with false and drops the route and its code.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "playground",
        lazy: () => import("./playground/route"),
        // Nothing shows for the moment the page's code loads.
        HydrateFallback: () => null,
      },
    ]
  : [];

/**
 * The screens. The browser owns which screen shows; the engine will own the
 * Learner's place. The app uses hash URLs, so the server serves one page by
 * name and never maps a path to a screen.
 */
export const routes: RouteObject[] = [
  {
    Component: Shell,
    children: [
      { index: true, Component: Welcome },
      { path: "journey", Component: Journey },
      { path: "lesson/:lessonId", Component: LessonOverview },
      { path: "lesson/:lessonId/step", Component: Workspace },
      { path: "lesson/:lessonId/complete", Component: LessonComplete },
      { path: "progress", Component: Progress },
      { path: "*", Component: NotFound },
    ],
  },
  ...devRoutes,
];
