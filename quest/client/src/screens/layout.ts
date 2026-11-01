// The page shapes every screen is built on.

/** A Lesson screen: one column of about 720 px, which fits half a laptop screen. */
export const COLUMN =
  "mx-auto grid max-w-column gap-5 px-5 pt-8 pb-24 [&>*]:min-w-0";

/** The Learning journey: a wider page. */
export const WIDE =
  "mx-auto grid max-w-wide gap-5.5 px-6 pt-9 pb-24 max-sm:px-5";

/** A calm, centred moment: Welcome, Lesson complete. */
export const MOMENT =
  "mx-auto grid min-h-(--moment-height) max-w-hero content-center justify-items-center gap-4 px-5 pt-8 pb-24 text-center";

/** A surface card. */
export const BOX =
  "grid gap-3 rounded-lg border border-line bg-surface p-5 shadow-sm";

/** A small label above a heading. */
export const EYEBROW =
  "text-xs font-heading tracking-eyebrow text-muted uppercase";

/** A quiet text link drawn as a button. */
export const QUIET_LINK =
  "rounded-sm px-0.5 py-1 text-sm text-muted underline underline-offset-3 transition-colors duration-(--duration-fast) ease-out hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
