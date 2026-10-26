import { Link } from "react-router";
import { ButtonLink } from "../components/Button";
import { Icon } from "../components/Icon";
import { LESSONS } from "../course/placeholder";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { BOX, QUIET_LINK } from "./layout";

const first = LESSONS[0];

/** Welcome on a first run; a return will show the resume card here. */
export function Welcome() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-hero content-center justify-items-center gap-4.5 px-5 pt-12 pb-24 text-center">
      <Pip size="hero" className="mb-2" />
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
            is where you run Claude Code and type every command
          </span>
        </li>
      </ul>
      {first && (
        <ButtonLink
          to={`/lesson/${first.id}`}
          variant="primary"
          size="lg"
          iconEnd="arrow"
        >
          Start the first lesson
        </ButtonLink>
      )}
      <Link to="/journey" className={QUIET_LINK}>
        See all three levels first
      </Link>
    </main>
  );
}
