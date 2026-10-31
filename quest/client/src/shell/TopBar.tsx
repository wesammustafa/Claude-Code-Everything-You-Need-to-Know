import { useState } from "react";
import { Link, NavLink, useMatch } from "react-router";
import type { Snapshot, StepSummary } from "@quest/contract";
import { Button } from "../components/Button";
import { Command } from "../components/Command";
import { Icon, type IconName } from "../components/Icon";
import { IconButton } from "../components/IconButton";
import { InlineText } from "../components/InlineText";
import { Panel } from "../components/Panel";
import { LEVEL_NAMES, lessonEyebrow, lessonLabel } from "../course/labels";
import { usePagePanel } from "../pages/PagePanel";
import { summaryOf, useCourseSnapshot } from "../screens/lesson";
import { BrandMark } from "./BrandMark";

const NAV_LINK =
  "inline-flex h-8.5 items-center gap-1.75 rounded-md px-3 text-sm font-semibold text-muted no-underline " +
  "transition-[background-color,color] duration-(--duration-fast) ease-out " +
  "hover:bg-surface-2 hover:text-text aria-[current=page]:bg-surface-2 aria-[current=page]:text-text " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const CRUMB =
  "rounded-sm px-1.5 py-1 text-muted no-underline transition-[background-color,color] duration-(--duration-fast) ease-out " +
  "hover:bg-surface-2 hover:text-text aria-[current=page]:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function MainLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: IconName;
  children: string;
}) {
  return (
    <NavLink to={to} className={NAV_LINK}>
      <Icon name={icon} />
      <span className="max-md:sr-only">{children}</span>
    </NavLink>
  );
}

type OpenPanel = "steps" | "card" | "settings" | null;

const STEP_STATE: Record<StepSummary["state"], string> = {
  done: "done",
  current: "current",
  todo: "to do",
};

/** The active Lesson's steps in play order, each with its state in words. */
function StepOutline({ steps }: { steps: StepSummary[] }) {
  return (
    <ol className="grid gap-2" data-step-outline="">
      {steps.map((step) => (
        <li
          key={step.id}
          {...(step.state === "current" ? { "aria-current": "step" } : {})}
          className="grid gap-0.5 rounded-md border border-line px-3 py-2 aria-[current=step]:border-accent-mark"
        >
          <span className="font-semibold">
            <InlineText text={step.title} />
          </span>
          <span className="flex flex-wrap gap-2 text-sm text-muted">
            <span>{step.part}</span>
            {step.optional && <span>optional</span>}
            <span>{STEP_STATE[step.state]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The skills card: each entry in the snapshot's order, with the Lesson it came from. */
function CardEntries({ snapshot }: { snapshot: Snapshot }) {
  const where = (id: string): string => {
    for (const level of snapshot.course.levels) {
      const summary = level.lessons.find((l) => l.id === id);
      if (summary)
        return lessonEyebrow(level.id, summary.number, summary.capstone);
    }
    return id;
  };
  return (
    <ol className="grid gap-3" data-skills-card="">
      {snapshot.learner.card.map((entry) => (
        <li
          key={`${entry.lesson}:${entry.skill}`}
          className="grid gap-1.5 rounded-md border border-line p-3"
        >
          <span className="text-xs text-muted">{where(entry.lesson)}</span>
          <Command text={entry.show} />
          <span className="text-sm">
            <InlineText text={entry.does} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The slim top bar, which the shell holds at the top of the window: the brand, where the Learner is in a Lesson, and the main places. */
export function TopBar() {
  const match = useMatch("/lesson/:lessonId/*");
  const snapshot = useCourseSnapshot();
  const routeId = match?.params.lessonId;
  const lesson = summaryOf(snapshot, routeId);
  const level = snapshot?.course.levels.find((l) =>
    l.lessons.some((summary) => summary.id === routeId),
  );
  const levelName = level ? LEVEL_NAMES[level.id] : "";
  const label = lesson ? lessonLabel(lesson.number, lesson.capstone) : "";
  // Steps outlines the active Lesson; a Lesson the Learner only browses
  // shows its crumbs alone.
  const active = lesson !== null && snapshot?.lesson.id === lesson.id;
  const [panel, setPanel] = useState<OpenPanel>(null);
  const closePanel = () => {
    setPanel(null);
  };
  const pages = usePagePanel();
  const steps =
    active && snapshot.lesson.phase === "playing"
      ? snapshot.lesson.steps
      : null;
  const card = snapshot?.learner.card ?? [];

  return (
    <header className="relative z-10 grid h-(--topbar-height) grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line bg-bg/82 pr-4 pl-5 backdrop-blur-md backdrop-saturate-140 max-sm:pr-2 max-sm:pl-3.5">
      <Link
        to="/"
        className="justify-self-start rounded-sm px-1 py-1.5 text-text no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <BrandMark />
      </Link>

      {lesson ? (
        <nav
          aria-label="Where you are"
          className="flex min-w-0 items-center gap-1 text-sm"
        >
          {/* The crumbs need the room of a wide window, and Steps shows its label from md: narrower, either would crowd the brand or the main nav and push this cluster off centre. */}
          <Link to="/journey" className={`${CRUMB} max-lg:hidden`}>
            {levelName}
          </Link>
          <Icon name="chevron" size="sm" className="text-muted max-lg:hidden" />
          {/* On the Lesson's overview this crumb is the current page, which NavLink marks. */}
          <NavLink
            to={`/lesson/${lesson.id}`}
            end
            className={`${CRUMB} max-lg:hidden`}
          >
            {label}
          </NavLink>
          {active && (
            <Button
              variant="secondary"
              size="sm"
              icon="steps"
              className="max-md:gap-0 max-md:px-1.75 lg:ml-2"
              aria-haspopup="dialog"
              onClick={() => {
                setPanel("steps");
              }}
            >
              <span className="max-md:sr-only">Steps</span>
            </Button>
          )}
        </nav>
      ) : (
        <span />
      )}

      <nav
        aria-label="Main"
        className="flex items-center gap-0.5 justify-self-end"
      >
        <MainLink to="/journey" icon="map">
          Journey
        </MainLink>
        <MainLink to="/progress" icon="progress">
          Progress
        </MainLink>
        {card.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            aria-haspopup="dialog"
            onClick={() => {
              setPanel("card");
            }}
          >
            Your card
          </Button>
        )}
        <IconButton
          icon="gear"
          label="Settings"
          aria-haspopup="dialog"
          onClick={() => {
            setPanel("settings");
          }}
        />
      </nav>

      <Panel
        title="Steps"
        open={active && panel === "steps"}
        onClose={closePanel}
      >
        {lesson && (
          <p className="text-sm text-muted">
            {levelName} · {label} · <InlineText text={lesson.title} />
          </p>
        )}
        {steps ? (
          <StepOutline steps={steps} />
        ) : (
          <p className="text-sm text-muted">
            The step outline shows once the Lesson starts.
          </p>
        )}
      </Panel>
      <Panel
        title="Your card"
        open={panel === "card" && snapshot !== null && card.length > 0}
        onClose={closePanel}
      >
        {snapshot && <CardEntries snapshot={snapshot} />}
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          aria-haspopup="dialog"
          onClick={() => {
            setPanel(null);
            pages.open("docs/reference/commands.md");
          }}
        >
          Commands by level
        </Button>
      </Panel>
      <Panel title="Settings" open={panel === "settings"} onClose={closePanel}>
        <p className="text-sm text-muted">
          Theme, motion, Work folders and help show here. The theme follows your
          system setting.
        </p>
      </Panel>
    </header>
  );
}
