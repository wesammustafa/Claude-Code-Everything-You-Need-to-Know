import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QuestMotion } from "./components/QuestMotion";
import { restoreSettings } from "./lib/settings";
import { routes } from "./routes";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");

// The stored theme and motion go on <html> before the first render, so Pip
// and the first screen start from them.
restoreSettings();

const router = createHashRouter(routes);

createRoot(root).render(
  <StrictMode>
    <QuestMotion>
      <RouterProvider router={router} />
    </QuestMotion>
  </StrictMode>,
);
