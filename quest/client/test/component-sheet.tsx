// The design components on one sheet, for e2e/components.spec.ts: the dev
// server serves this file to the test browser, which mounts it beside the
// app to read what a real engine draws (a contrast theme, the `reduced`
// variant), which jsdom cannot compute. It never ships.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Choice } from "../src/components/Choice";
import { ProgressBar } from "../src/components/ProgressBar";
import { QuestMotion } from "../src/components/QuestMotion";
import { Segmented } from "../src/components/Segmented";
import { Switch } from "../src/components/Switch";

function Sheet() {
  const [on, setOn] = useState(false);
  return (
    <QuestMotion>
      <div className="grid justify-items-start gap-4 p-4">
        <Switch label="Sound" checked={on} onChange={setOn} />
        <Switch label="Always on" checked onChange={() => {}} />
        <Segmented
          legend="Theme"
          value="light"
          onChange={() => {}}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
        <Choice
          legend="Which one?"
          value="a"
          onChange={() => {}}
          options={[
            { id: "a", text: "This one" },
            { id: "b", text: "That one" },
          ]}
        />
        <ProgressBar value={1} max={2} label="Progress" />
      </div>
    </QuestMotion>
  );
}

/** Mounts the sheet in a container of its own at the end of <body>. */
export function mountSheet(): void {
  const host = document.createElement("div");
  host.dataset.sheet = "";
  document.body.append(host);
  createRoot(host).render(<Sheet />);
}
