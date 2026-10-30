import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "../components/Button";
import { CheckLines } from "../components/CheckLines";
import { Command } from "../components/Command";
import { HelpOffer } from "../components/HelpOffer";
import { Hints } from "../components/Hints";
import { Says } from "../components/Says";
import { StepDots } from "../components/StepDots";
import { Where } from "../components/Where";
import {
  useHelpShowing,
  usePipInput,
  usePipLook,
  usePipStep,
} from "../pip/PipStage";
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
// Placeholder hints until the snapshot carries the step's own, and says
// when each is ready: here the first is ready from the start, as at Hinted.
const HINTS = ["The step's first hint shows here, one rung at a time."];

/**
 * The Lesson workspace: step dots, Pip beside the step, the step card, its
 * hints and the sticky action bar. Pip watches a copied command, a hint
 * opening and the check's lines, and offers the hint when the step seems
 * stuck (the director's stuck rule).
 */
export function Workspace() {
  const lesson = useLesson();
  const main = useRef<HTMLElement>(null);
  const newestHint = useRef<HTMLDivElement>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const tellPip = usePipInput();
  const look = usePipLook();
  const offering = useHelpShowing();
  usePipStep(lesson ? `${lesson.id}:0` : null, hintsShown < HINTS.length);

  // A hint that opens takes focus, since the button that opened it has gone,
  // and Pip looks at it.
  useEffect(() => {
    const hint = newestHint.current;
    if (hintsShown === 0 || hint === null) return;
    hint.focus();
    look("hint", hint);
  }, [hintsShown, look]);

  if (!lesson) return <NotFound />;

  const showNextHint = () => {
    // Any rung opening closes the offer and starts the 45 s clock again.
    tellPip({ type: "hintOpened" });
    setHintsShown((n) => Math.min(n + 1, HINTS.length));
  };
  const dismissOffer = () => {
    tellPip({ type: "helpDismissed" });
    // The offer's buttons have gone: focus goes back to the step's heading.
    main.current?.querySelector<HTMLElement>("[data-page-title]")?.focus();
  };

  return (
    <>
      <main ref={main} className={`${COLUMN} gap-4.5 pt-5.5 pb-44`}>
        <StepDots steps={STEPS} at={0} />
        {/* The status words stay keyed as they are while the offer comes
            and goes, so the live region never says them twice. */}
        <Says tone={offering ? "offer" : "watching"} textKey="watching">
          <span>
            <span
              className="mr-2 inline-block size-2 animate-breathe rounded-full bg-teal align-middle"
              aria-hidden="true"
            />
            Watching your Practice copy.
          </span>
          <HelpOffer
            open={offering}
            onShowHint={showNextHint}
            onDismiss={dismissOffer}
          />
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
            <Where
              kind="terminal"
              label="Your terminal"
              note="in your Practice copy"
            />
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
        <Hints
          hints={HINTS}
          shown={hintsShown}
          onShowNext={showNextHint}
          newestRef={newestHint}
        />
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
