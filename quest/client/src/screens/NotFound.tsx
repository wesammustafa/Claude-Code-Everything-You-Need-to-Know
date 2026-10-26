import { ButtonLink } from "../components/Button";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { MOMENT } from "./layout";

/** An address the app has no screen for. */
export function NotFound() {
  return (
    <main className={MOMENT}>
      <Pip size="beside" className="mb-2" />
      <PageTitle title="Nothing here" className="text-2xl" />
      <p className="text-muted">
        This address has no screen. The learning journey has every lesson.
      </p>
      <ButtonLink
        to="/journey"
        variant="primary"
        iconEnd="arrow"
        className="mt-2"
      >
        Open the learning journey
      </ButtonLink>
    </main>
  );
}
