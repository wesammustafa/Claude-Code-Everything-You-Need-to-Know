import { Button, ButtonLink } from "../components/Button";
import { CheckLines } from "../components/CheckLines";
import { Command } from "../components/Command";
import { Icon } from "../components/Icon";
import { Says } from "../components/Says";
import { StepDots } from "../components/StepDots";
import { ActionBar } from "../shell/ActionBar";
import { PageTitle } from "../shell/PageTitle";
import { NotFound } from "./NotFound";
import { COLUMN, EYEBROW } from "./layout";
import { useLesson } from "./lesson";

// Placeholder steps until the snapshot carries the Lesson's own.
const STEPS = [
  "First step",
  "Second step",
  "Third step",
  "Fourth step",
  "Check",
];

/** The Lesson workspace: step dots, Pip beside the step, the step card and the sticky action bar. */
export function Workspace() {
  const lesson = useLesson();
  if (!lesson) return <NotFound />;

  return (
    <>
      <main className={`${COLUMN} gap-4.5 pt-5.5 pb-44`}>
        <StepDots steps={STEPS} at={0} />
        <Says tone="watching">
          <span>
            <span
              className="mr-2 inline-block size-2 animate-breathe rounded-full bg-teal align-middle"
              aria-hidden="true"
            />
            Watching your Practice copy.
          </span>
        </Says>
        <article className="grid gap-5 rounded-xl border border-line bg-surface p-6.5 shadow-md max-sm:p-5 [&>*]:min-w-0">
          <header className="grid gap-1">
            <span
              className={EYEBROW}
            >{`Step 1 of ${String(STEPS.length)}`}</span>
            <PageTitle
              title={`${STEPS[0] ?? "Step"}: ${lesson.title}`}
              className="text-2xl"
            >
              {STEPS[0]}
            </PageTitle>
          </header>
          <div className="grid justify-items-start gap-3.5">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Icon name="terminal" size="sm" className="text-accent-text" />
              <b>Your terminal</b>
              <span className="text-muted">in your Practice copy</span>
            </span>
            <p className="text-lg font-semibold tracking-tight">
              The step's goal shows here, with the command to type.
            </p>
            <Command text={`npm run check -- ${lesson.id}`} />
          </div>
          <CheckLines
            lines={[
              { text: "A line of the Check that passes", ok: true },
              {
                text: "A line of the Check that is not met yet",
                ok: false,
                evidence: "What the Check saw shows here.",
              },
            ]}
          />
        </article>
      </main>
      <ActionBar
        start={
          <ButtonLink to={`/lesson/${lesson.id}`} variant="ghost" icon="back">
            Back
          </ButtonLink>
        }
      >
        <Button variant="ghost">Skip</Button>
        <Button icon="refresh">Check again</Button>
        <ButtonLink
          to={`/lesson/${lesson.id}/complete`}
          variant="primary"
          iconEnd="arrow"
        >
          Next step
        </ButtonLink>
      </ActionBar>
    </>
  );
}
