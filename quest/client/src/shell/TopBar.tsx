import { useState } from "react";
import { Link, NavLink, useMatch } from "react-router";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { IconButton } from "../components/IconButton";
import { InlineText } from "../components/InlineText";
import { Panel } from "../components/Panel";
import { findLesson, lessonLabel, levelOf } from "../course/placeholder";
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

type OpenPanel = "steps" | "settings" | null;

/** The slim top bar, which the shell holds at the top of the window: the brand, where the Learner is in a Lesson, and the main places. */
export function TopBar() {
  const match = useMatch("/lesson/:lessonId/*");
  const lesson = findLesson(match?.params.lessonId);
  const [panel, setPanel] = useState<OpenPanel>(null);
  const closePanel = () => {
    setPanel(null);
  };

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
            {levelOf(lesson).name}
          </Link>
          <Icon name="chevron" size="sm" className="text-muted max-lg:hidden" />
          {/* On the Lesson's overview this crumb is the current page, which NavLink marks. */}
          <NavLink
            to={`/lesson/${lesson.id}`}
            end
            className={`${CRUMB} max-lg:hidden`}
          >
            {lessonLabel(lesson)}
          </NavLink>
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
        <IconButton
          icon="gear"
          label="Settings"
          aria-haspopup="dialog"
          onClick={() => {
            setPanel("settings");
          }}
        />
      </nav>

      <Panel title="Steps" open={panel === "steps"} onClose={closePanel}>
        {lesson && (
          <p className="text-sm text-muted">
            {levelOf(lesson).name} · {lessonLabel(lesson)} ·{" "}
            <InlineText text={lesson.title} />
          </p>
        )}
        <p className="text-sm text-muted">
          The Lesson's step outline shows here.
        </p>
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
