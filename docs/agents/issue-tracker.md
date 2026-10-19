# Issue tracker: local Markdown

Issues and specs live in private `.scratch/` files. These are the canonical records for current work.

## Find work

Start with `.scratch/README.md`, then read the relevant feature's README and ticket. Follow their links to the current roadmap, spec and decisions.

Keep `.scratch/` ignored by Git.

## Implementation tickets

- Use `.scratch/<feature>/tickets/<NN>-<slug>.md`, one file per ticket.
- Continue the shared implementation-ticket numbering across features. Check existing tickets, including completed-ticket folders, before allocating a number.
- Preserve existing paths, completion records and feature conventions.
- Record triage roles in a `**Status:**` line near the top, using [Triage labels](triage-labels.md).
- Preserve existing status details and owner approval requirements when triaging.
- Append discussion under `## Comments`.
- Follow the feature's existing spec or roadmap path.

When a skill says "publish to the issue tracker", save the ticket or spec in the relevant feature directory.

When a skill says "fetch the relevant ticket", read the referenced file. Resolve a bare implementation-ticket number across feature ticket folders.

## Wayfinding records

Wayfinding uses a separate layout and lifecycle:

- Map: `.scratch/<feature>/map.md`.
- Child: `.scratch/<feature>/issues/<NN>-<slug>.md`, using that map's local numbering.
- Type: `Type: research`, `prototype`, `grilling` or `task`.
- Dependencies: `Blocked by:` near the top, referring to children of the same map.
- Claim: save `Status: claimed` before starting work.
- Resolve: append `## Answer`, set `Status: resolved`, then add an answer summary and link to the map's Decisions-so-far.
- Frontier: choose the first child by number that is unresolved, unclaimed and has every dependency resolved.

Keep wayfinding lifecycle states distinct from implementation-ticket triage roles.
