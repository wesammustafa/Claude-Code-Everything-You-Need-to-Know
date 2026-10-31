import { Link, useNavigate } from "react-router";
import type { PlayingLesson, Snapshot, StepDownLesson } from "@quest/contract";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { InlineText } from "../components/InlineText";
import { ProgressBar } from "../components/ProgressBar";
import { lessonEyebrow } from "../course/labels";
import { useConnection } from "../live/LiveProvider";
import { useActionProps } from "../live/useAction";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { BOX, EYEBROW, QUIET_LINK } from "./layout";
import { summaryOf, useCourseSnapshot } from "./lesson";

/** The words while the first snapshot is awaited: the host asks git first. */
export const WAITING_LINE = "Asking git about this folder…";

const HERO =
  "mx-auto grid min-h-dvh max-w-hero content-center justify-items-center gap-4.5 px-5 pt-12 pb-24 text-center";

/**
 * Welcome on a first run, Resume on a return: Pip large and centred, one
 * action. The words state no Claude Code fact; the resume card's are the
 * snapshot's.
 */
export function Welcome() {
  const snapshot = useCourseSnapshot();
  const waiting = useConnection() === "waiting";
  const lesson = snapshot?.lesson;
  const resuming =
    snapshot?.learner.welcomed === true &&
    (lesson?.phase === "playing" || lesson?.phase === "step-down")
      ? lesson
      : null;
  const name = snapshot?.learner.name ?? null;

  return (
    <main className={HERO}>
      <Pip size="hero" className="mb-2" />
      {name !== null && (
        <p className="text-lg font-semibold text-accent-text">{`Hi ${name}!`}</p>
      )}
      {snapshot && resuming ? (
        <Resume snapshot={snapshot} lesson={resuming} />
      ) : (
        <FirstRun snapshot={snapshot} />
      )}
      {/* Shown only once the shell marks the wait as noticeable, so a
          snapshot that comes at once shows no flash of it. */}
      {waiting && (
        <p
          className="hidden text-sm text-muted [[data-connection=waiting]_&]:block"
          data-waiting-line=""
        >
          {WAITING_LINE}
        </p>
      )}
    </main>
  );
}

function FirstRun({ snapshot }: { snapshot: Snapshot | null }) {
  const navigate = useNavigate();
  const first = snapshot?.course.next ?? null;
  const welcomed = snapshot?.learner.welcomed === true;
  // Welcome is read once, before any Lesson is opened, so course.next is
  // still the active Lesson and its route shows it without a lesson.open.
  const open = () => {
    if (first !== null) void navigate(`/lesson/${first}`);
  };
  const finish = useActionProps(
    "welcome.finish",
    { type: "welcome.finish" },
    open,
  );
  return (
    <>
      <PageTitle title="Welcome" className="text-display max-sm:text-3xl">
        Learn Claude Code by using it.
      </PageTitle>
      <p className="max-w-moment text-lg text-muted">
        Every lesson happens in a real project, your Practice copy, with this
        page beside your terminal.
      </p>
      <ul className="my-2 grid w-full grid-cols-2 gap-3 text-left max-sm:grid-cols-1">
        <li className={`${BOX} gap-1 text-sm`}>
          <Icon name="browser" size="xl" className="mb-1 text-accent-text" />
          <b className="text-control">This page</b>
          <span className="text-muted">
            shows one step at a time and checks your work as you go
          </span>
        </li>
        <li className={`${BOX} gap-1 text-sm`}>
          <Icon name="terminal" size="xl" className="mb-1 text-accent-text" />
          <b className="text-control">Your terminal</b>
          <span className="text-muted">
            is the other window: each step says what to do there
          </span>
        </li>
      </ul>
      {first !== null && (
        <Button
          variant="primary"
          size="lg"
          iconEnd="arrow"
          {...(welcomed ? { onClick: open } : finish)}
        >
          Start the first lesson
        </Button>
      )}
      <Link to="/journey" className={QUIET_LINK}>
        See all three levels first
      </Link>
    </>
  );
}

/** The step the Learner is on, from 1, and how many there are. */
function placeOf(lesson: PlayingLesson | StepDownLesson): [number, number] {
  if (lesson.phase === "step-down") return [0, 0];
  const at = lesson.steps.findIndex((step) => step.state === "current");
  return [at + 1, lesson.steps.length];
}

function Resume({
  snapshot,
  lesson,
}: {
  snapshot: Snapshot;
  lesson: PlayingLesson | StepDownLesson;
}) {
  const navigate = useNavigate();
  const summary = summaryOf(snapshot, lesson.id);
  const [at, of] = placeOf(lesson);
  const go = () => void navigate(`/lesson/${lesson.id}/step`);
  const resume = useActionProps(
    "lesson.open",
    { type: "lesson.open", lesson: lesson.id },
    go,
  );
  return (
    <>
      <PageTitle title="Welcome back" className="text-display max-sm:text-3xl">
        Welcome back.
      </PageTitle>
      <section
        aria-label="Where you left off"
        className={`${BOX} w-full max-w-moment justify-items-start text-left`}
      >
        <span className={EYEBROW}>
          {lessonEyebrow(
            lesson.level,
            summary?.number ?? null,
            lesson.capstone,
          )}
        </span>
        <h2 className="text-xl">
          <InlineText text={lesson.title} />
        </h2>
        {of > 0 && (
          <>
            <p className="text-sm text-muted">{`Step ${String(at)} of ${String(of)}`}</p>
            <ProgressBar value={at - 1} max={of} label="Steps done" />
          </>
        )}
        <Button variant="primary" size="lg" iconEnd="arrow" {...resume}>
          Continue
        </Button>
      </section>
    </>
  );
}
