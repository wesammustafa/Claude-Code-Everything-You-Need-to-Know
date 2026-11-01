import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QuestMotion } from "./components/QuestMotion";
import { routes } from "./routes";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");

const router = createHashRouter(routes);

createRoot(root).render(
  <StrictMode>
    <QuestMotion>
      <RouterProvider router={router} />
    </QuestMotion>
  </StrictMode>,
);
