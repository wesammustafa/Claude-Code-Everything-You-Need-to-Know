// Run with: /stale-docs-audit            (audits this repo's default doc set)
//           /stale-docs-audit on README.md docs/skills.md
//
// Shape: fan one reader agent per file, then have independent skeptics try to
// REFUTE each claim before it's reported. The refute-by-default framing is what
// keeps plausible-but-wrong findings out of the result.

export const meta = {
  name: 'stale-docs-audit',
  description: "Find version- or date-pinned claims in this repo's docs that no longer match official Claude Code documentation",
  phases: [
    { title: 'Scan', detail: 'one agent per file extracts pinned claims' },
    { title: 'Verify', detail: 'independent skeptics try to refute each claim' },
  ],
}

const DEFAULT_TARGETS = [
  'README.md',
  'docs/workflows.md',
  'docs/agent-teams.md',
  'docs/skills.md',
  'docs/reference/changelog.md',
  'docs/reference/commands.md',
  'docs/reference/effort-levels.md',
  'docs/reference/models.md',
  'docs/reference/faq.md',
]

const targets = Array.isArray(args) && args.length ? args : DEFAULT_TARGETS

const CLAIMS_SCHEMA = {
  type: 'object',
  required: ['claims'],
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'line'],
        properties: {
          claim: { type: 'string', description: 'The pinned claim, quoted from the file' },
          line: { type: 'integer', description: '1-indexed line the claim appears on' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['stale', 'reason'],
  properties: {
    stale: { type: 'boolean', description: 'True only if the claim is provably wrong today' },
    reason: { type: 'string', description: 'What the current official docs say instead' },
    source: { type: 'string', description: 'URL that settles it' },
    correction: { type: 'string', description: 'Suggested replacement text' },
  },
}

phase('Scan')
log(`Auditing ${targets.length} file(s).`)

const results = await pipeline(
  targets,

  // Stage 1 — extract only claims that CAN go stale. Prose and opinion are noise here.
  (_, file) => agent(
    `Read ${file} in this repository. Extract every factual claim pinned to a version, ` +
    `date, price, numeric limit, command name, file path, or setting key — the kinds of ` +
    `claim that can silently go stale. Skip prose, opinion, mental models, and advice. ` +
    `Quote each claim verbatim and give its 1-indexed line number.`,
    { label: file, phase: 'Scan', schema: CLAIMS_SCHEMA },
  ),

  // Stage 2 — verify each claim from this file as soon as the file is scanned.
  // No barrier: file B is still scanning while file A's claims are being checked.
  (scan, file) => parallel(
    (scan?.claims ?? []).map(c => () =>
      agent(
        `Try to REFUTE this documentation claim from ${file}:\n\n"${c.claim}"\n\n` +
        `Check it against current official sources (code.claude.com/docs, ` +
        `platform.claude.com/docs, anthropic.com/news, the anthropics/claude-code CHANGELOG). ` +
        `Set stale:true ONLY if you can show it is wrong today and cite the source that ` +
        `settles it. If you cannot verify it either way, set stale:false — an unverified ` +
        `claim is not a stale claim, and a false report costs more than a missed one.`,
        { label: `${file}:${c.line}`, phase: 'Verify', schema: VERDICT_SCHEMA },
      ).then(v => ({ file, line: c.line, claim: c.claim, ...v })),
    ),
  ),
)

const checked = results.flat().filter(Boolean)
const stale = checked.filter(r => r.stale)

log(`${checked.length} claim(s) verified · ${stale.length} confirmed stale.`)

return {
  filesAudited: targets.length,
  claimsVerified: checked.length,
  stale: stale.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
}
