import { GIT, HOLDS } from "./content.ts";

// How much help a step gets. GUIDED shows every command, HINTED shows the
// goal with hints on request, CHALLENGE shows the goal only. A skill's help
// fades each time a lesson asks for it again, in any level, so each lesson
// after a level's first gives less help than that first one. A level's first
// lesson brings new skills, so it may start with more help than the capstone
// before it, and a lesson full of new skills may give more help than the one
// two before it in its level: the climb test reports that dip, not fails it.
export const TIERS = ["guided", "hinted", "challenge"];
const rank = (t) => TIERS.indexOf(t);
const at = (i) => TIERS[Math.max(0, Math.min(2, i))];

// A step the app checks: a check item, git status (the whole tree or part
// of it, ticket 88), what a file holds (ticket 87), or a git probe (ticket
// 105). A `file` beat, done once its file holds any line, is not one.
const CHECKED = new Set(["check", ...GIT, ...HOLDS, "probe"]);
const verifiable = (step) => step.beats.some((b) => CHECKED.has(b.verify.kind));

// The tier the course's rule gives each step of `lessonIndex`, from the
// content of the lessons before it. `contents` is every lesson's parsed
// content (or null), in course order. An earlier lesson k counts toward a
// skill only when `counted(k, skill)`: by default the course plan counts
// them all. An optional step, which a learner may skip, counts toward no
// skill (ticket 102). A Tear down step after the Check gets the help a Your
// turn step does, and CHALLENGE in a capstone.
export function ruleTiers(contents, lessonIndex, counted = () => true) {
  const lesson = contents[lessonIndex];
  const before = new Map();
  contents.slice(0, lessonIndex).forEach((c, k) => {
    for (const skill of new Set(
      (c?.steps ?? []).filter((s) => !s.optional).map((s) => s.skill),
    ))
      if (counted(k, skill)) before.set(skill, (before.get(skill) ?? 0) + 1);
  });
  const lastYour = [...lesson.steps]
    .reverse()
    .find((s) => s.part === "Your turn" && verifiable(s));
  const capstone = lesson.lesson?.endsWith("capstone");
  return lesson.steps.map((s) => {
    if (s.part === "Check" || s.part === "Warm-up" || capstone)
      return "challenge";
    const base = Math.min(2, before.get(s.skill) ?? 0);
    if (s.part === "Worked example") return at(base);
    return at(Math.max(base, 1) + (s === lastYour ? 1 : 0));
  });
}

// The tier a learner meets: "less help" turns GUIDED into HINTED for one
// lesson, and an eased skill comes back one tier easier.
export function effectiveTier(tier, { lessHelp = false, eased = false } = {}) {
  let r = rank(tier);
  if (lessHelp && r === 0) r = 1;
  if (eased) r -= 1;
  return at(r);
}

export const mix = (tiers) =>
  TIERS.map((t) => tiers.filter((x) => x === t).length);

// Scales a mix to `cells` glyphs. The share of steps with less help is
// rounded first, so a lesson with a larger share never draws fewer.
export function scaleMix(m, cells) {
  const total = m.reduce((a, b) => a + b, 0) || 1;
  const less = Math.round(((m[1] + m[2]) * cells) / total);
  const challenge = Math.min(less, Math.round((m[2] * cells) / total));
  return [cells - less, less - challenge, challenge];
}
