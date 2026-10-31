import { useEffect, useId, useState } from "react";
import { Button } from "../components/Button";
import { Segmented } from "../components/Segmented";
import {
  applyMotion,
  applyTheme,
  type MotionChoice,
  readMotion,
  readTheme,
  type ThemeChoice,
} from "../lib/settings";
import { pageIndex } from "../pages/fetch";
import { WorkFolders } from "./WorkFolders";

const THEMES = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const MOTIONS = [
  { value: "system", label: "System" },
  { value: "reduce", label: "Reduced" },
  { value: "full", label: "Full" },
] as const;

const COMMIT = /^[0-9a-f]{40}$/;
const SHORT_COMMIT = 12;

type Release =
  { state: "loading" } | { state: "ready"; ref: string } | { state: "failed" };

function releaseText(release: Release): string {
  if (release.state === "loading") return "Release: loading";
  if (release.state === "failed") return "Release: unavailable";
  return COMMIT.test(release.ref)
    ? `Built from commit ${release.ref.slice(0, SHORT_COMMIT)}`
    : `Release ${release.ref}`;
}

/**
 * The Settings panel's body: the theme and motion choices, which apply at
 * once and stay in this browser; the Work folders slot; Help, which opens the
 * reference pages in the page panel; and the release the pages came from,
 * read from the page index when the panel opens.
 */
export function SettingsBody({
  onOpenPage,
}: {
  onOpenPage: (path: string) => void;
}) {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [motion, setMotion] = useState<MotionChoice>(readMotion);
  const [release, setRelease] = useState<Release>({ state: "loading" });
  const foldersId = useId();
  const helpId = useId();

  useEffect(() => {
    let live = true;
    pageIndex().then(
      (index) => {
        if (live) setRelease({ state: "ready", ref: index.ref });
      },
      () => {
        if (live) setRelease({ state: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <Segmented
        legend="Theme"
        options={THEMES}
        value={theme}
        onChange={(choice) => {
          setTheme(choice);
          applyTheme(choice);
        }}
      />
      <Segmented
        legend="Motion"
        options={MOTIONS}
        value={motion}
        onChange={(choice) => {
          setMotion(choice);
          applyMotion(choice);
        }}
      />
      <section
        aria-labelledby={foldersId}
        data-settings="work-folders"
        className="grid gap-2"
      >
        <h3 id={foldersId} className="text-sm font-semibold">
          Work folders
        </h3>
        <WorkFolders />
      </section>
      <section aria-labelledby={helpId} className="grid gap-2">
        <h3 id={helpId} className="text-sm font-semibold">
          Help
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          aria-haspopup="dialog"
          onClick={() => {
            onOpenPage("docs/reference/commands.md");
          }}
        >
          Commands by level
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          aria-haspopup="dialog"
          onClick={() => {
            onOpenPage("docs/reference/glossary.md");
          }}
        >
          Glossary
        </Button>
        <p className="text-sm text-muted">
          An independent educational project. Not affiliated with or endorsed by
          Anthropic.
        </p>
      </section>
      <p
        className="text-sm text-muted"
        data-ref={release.state === "ready" ? release.ref : undefined}
      >
        {releaseText(release)}
      </p>
      <p className="text-sm text-muted">
        In a Codespace, keep the port private: the app is for you alone.
      </p>
    </>
  );
}
