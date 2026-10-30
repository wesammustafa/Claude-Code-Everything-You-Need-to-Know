// The design components on one sheet, for e2e/components.spec.ts: the dev
// server serves this file to the test browser, which mounts it beside the
// app to read what a real engine draws (a contrast theme, the `reduced`
// variant), which jsdom cannot compute. It never ships. The Badges' names
// are the step files' as of ticket 242; the sheet only needs 23 of them.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LessonBadge } from "../src/components/badges";
import { Choice } from "../src/components/Choice";
import { ProgressBar } from "../src/components/ProgressBar";
import { QuestMotion } from "../src/components/QuestMotion";
import { Segmented } from "../src/components/Segmented";
import { Switch } from "../src/components/Switch";

const BADGES = [
  ["b-1", "Explorer"],
  ["b-2", "Planner"],
  ["b-3", "Builder"],
  ["b-4", "Navigator"],
  ["b-5", "Keeper"],
  ["b-capstone", "Beginner"],
  ["i-1", "Crafter"],
  ["i-2", "Organizer"],
  ["i-3", "Tuner"],
  ["i-4", "Guardian"],
  ["i-5", "Enforcer"],
  ["i-6", "Delegator"],
  ["i-7", "Connector"],
  ["i-8", "Curator"],
  ["i-capstone", "Intermediate"],
  ["a-1", "Brancher"],
  ["a-2", "Strategist"],
  ["a-3", "Orchestrator"],
  ["a-4", "Scripter"],
  ["a-5", "Automator"],
  ["a-6", "Steward"],
  ["a-7", "Warden"],
  ["a-capstone", "Advanced"],
] as const;

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
      {(["sm", "xl"] as const).map((size) =>
        [true, false].map((earned) => (
          <div
            key={`${size}-${String(earned)}`}
            data-badges={`${size}-${earned ? "earned" : "unearned"}`}
            className="flex flex-wrap items-start gap-4 p-4"
          >
            {BADGES.map(([lesson, name]) => (
              <LessonBadge
                key={lesson}
                lesson={lesson}
                name={name}
                earned={earned}
                size={size}
              />
            ))}
          </div>
        )),
      )}
      <div data-badges="moments" className="flex items-start gap-4 p-4">
        <LessonBadge lesson="b-1" name="Explorer" earned size="xl" reveal />
        <LessonBadge
          lesson="a-capstone"
          name="Advanced"
          earned
          size="xs"
          caption={false}
        />
        <LessonBadge
          lesson="a-capstone"
          name="Advanced"
          earned={false}
          size="xs"
          caption={false}
        />
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
