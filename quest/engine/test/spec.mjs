// The spec's behavior list (spec, Behavior the engine keeps), as ids the
// tests tag with `// spec: <id>` on a line above them, one id a line. Each
// id has an owner: the engine's are proved by the action-driven tests here
// (ticket 208), the host's by quest/host's tests (ticket 209). Kept out of
// a test file, so importing it registers no test twice.
const engine = (id, note) => ({ id, owner: "engine", ...(note && { note }) });
const host = (id, note) => ({
  id,
  owner: "host",
  ticket: 209,
  ...(note && { note }),
});

export const SPEC = [
  ...["do", "predict", "ask", "type", "self"].map((k) =>
    engine(`verify.beat.${k}`),
  ),
  ...[
    "answer",
    "self",
    "none",
    "check-items",
    "check-all",
    "fresh",
    "fresh-since",
    "file",
    "json",
    "match",
    "no-match",
    "probe",
    "git-clean",
    "git-clean-paths",
    "git-changed",
    "git-only",
    "git-staged",
    "head-moved",
    "git-unchanged",
  ].map((k) => engine(`verify.value.${k}`)),
  ...[
    "rule",
    "counting",
    "less-help",
    "eases",
    "more-help",
    "challenge-try",
    "idle",
  ].map((k) => engine(`tiers.${k}`)),
  ...[
    "at-most-one",
    "first-missed",
    "challenge",
    "right-clears",
    "wrong-saved",
    "while-runs",
  ].map((k) => engine(`warmups.${k}`)),
  engine("folders.picked"),
  engine(
    "folders.default",
    "today the practice copy's root (levelFolder); the spec's project/ default is a todo in spec-gaps",
  ),
  engine("folders.asked-first-overview"),
  engine("folders.another-folder"),
  engine("folders.change-drops"),
  engine("folders.worked-copy"),
  engine("folders.health"),
  host(
    "folders.progress-in-copy",
    "the store writes the practice copy's root .practice/",
  ),
  engine(
    "newcopy.by-lesson-id",
    "today the new copy's root; the spec's project/ is a todo in spec-gaps",
  ),
  engine("newcopy.no-check"),
  engine(
    "newcopy.copy-refused",
    "today only the practice copy's root is refused; its project/ is a todo in spec-gaps",
  ),
  engine(
    "newcopy.i-capstone-pinned",
    "today pinned to the practice copy's root; the spec's project/ is a todo in spec-gaps",
  ),
  engine("needs.requires"),
  engine("needs.needs-commands"),
  host(
    "needs.path-lookup",
    "the host's commands effect looks each name up on PATH (path-lookup.mjs)",
  ),
  engine("guards.1-ask-numbers"),
  engine("guards.2-folder-match"),
  engine("guards.3-full-coverage"),
  engine("guards.4-watch-shape"),
  engine("guards.5-prereq-folder-asks"),
  engine("guards.6-fresh"),
  engine("guards.7-baseline"),
  host(
    "guards.8-rerun",
    "the host runs a check again when its evidence changed (host.mjs's check)",
  ),
  host(
    "guards.9-single-flight",
    "quest/host/src/flight.mjs singleFlight and owing",
  ),
  engine(
    "guards.9-engine",
    "only the current run's running counts, and poll effects carry no slow",
  ),
  engine("where.where"),
  engine("where.terminals"),
  engine("where.codespaces"),
  host("watching", "the watcher, its debounce and the poll"),
  host("subprocess-limits", "the check child's and git's limits"),
  host("never-runs-claude", "learn-io's read-only guards, widened"),
];
