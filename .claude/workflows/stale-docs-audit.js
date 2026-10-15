// Run with: /stale-docs-audit            (audits README.md, docs/ and the example READMEs)
//           /stale-docs-audit on README.md docs/skills.md
//           /stale-docs-audit with args { "dryRun": true }   (lists the pages and stops)
//
// Shape: one agent lists the pages, one reader agent per page extracts the
// claims that can go stale, then independent verifiers check those claims, a
// batch at a time, against their authoritative sources and sort each as stale,
// unverifiable or ok. Batching keeps a full run far below the runtime's cap on
// agents per workflow.
// An unverifiable claim is a defect too: cite it or cut it. The result is the
// body of one tracking issue for the maintainer; nothing edits a page.

export const meta = {
  name: 'stale-docs-audit',
  description: "Sort the volatile claims in this repo's docs as stale, unverifiable or ok against official sources, and draft one tracking issue",
  phases: [
    { title: 'Discover', detail: 'list README.md, every docs page and every example README' },
    { title: 'Scan', detail: 'one agent per page extracts volatile claims' },
    { title: 'Verify', detail: 'independent verifiers sort each claim' },
  ],
}

const LIST_PAGES = "git ls-files -- README.md ':(glob)docs/**/*.md' ':(glob)examples/**/README.md'"
const options = Array.isArray(args) ? { targets: args } : (args ?? {})

const PAGES_SCHEMA = {
  type: 'object',
  required: ['paths'],
  properties: { paths: { type: 'array', items: { type: 'string' } } },
}

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
          claim: { type: 'string', description: 'The claim, quoted from the page' },
          line: { type: 'integer', description: '1-indexed line the claim appears on' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['index', 'verdict', 'reason'],
  properties: {
    index: { type: 'integer', description: 'The number the claim has in the list you were given' },
    verdict: {
      type: 'string',
      enum: ['stale', 'unverifiable', 'ok'],
      description: 'stale: an authoritative source shows it is wrong today. ok: an authoritative source confirms it. unverifiable: neither.',
    },
    reason: { type: 'string', description: 'What the source says, or what you checked and could not find' },
    source: { type: 'string', description: 'URL that settles it, or the closest page you checked' },
    correction: { type: 'string', description: 'Suggested replacement text, for a stale claim' },
  },
}

const BATCH_SCHEMA = {
  type: 'object',
  required: ['verdicts'],
  properties: { verdicts: { type: 'array', items: VERDICT_SCHEMA } },
}

const BATCH_SIZE = 10
const batches = items =>
  Array.from({ length: Math.ceil(items.length / BATCH_SIZE) }, (_, i) => items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE))

phase('Discover')
let pages = options.targets
if (!pages?.length) {
  const listed = await agent(
    `In this repository, run exactly this command and return every path it prints, unchanged:\n\n${LIST_PAGES}`,
    { label: 'list pages', phase: 'Discover', schema: PAGES_SCHEMA },
  )
  pages = listed?.paths ?? []
}
log(`Auditing ${pages.length} page(s).`)

const bucket = (title, items, line) =>
  `### ${title}\n\n${items.length ? items.map(line).join('\n') : 'None.'}\n`

if (options.dryRun) {
  return {
    pages,
    issueBody: [
      '## Stale-docs audit (dry run)',
      '',
      `Would audit ${pages.length} page(s):`,
      '',
      ...pages.map(p => `- \`${p}\``),
      '',
      bucket('Stale', [], () => ''),
      bucket('Unverifiable', [], () => ''),
      bucket('Ok', [], () => ''),
    ].join('\n'),
  }
}

phase('Scan')
const results = await pipeline(
  pages,

  // Stage 1: extract only the claims that can go stale. Prose and opinion are noise here.
  (_, file) => agent(
    `Read ${file} in this repository. Extract every volatile claim: a version or date; a price, ` +
    `plan availability, or usage or rate limit; a model name, model ID or default; the name or ` +
    `behavior of a command, flag, setting, environment variable, hook event, tool or frontmatter ` +
    `field; a stability label; any count or statistic; or a third-party status fact (owner, ` +
    `license, archived). Skip mental models, analogies and advice. Quote each claim verbatim and ` +
    `give its 1-indexed line number.`,
    { label: file, phase: 'Scan', schema: CLAIMS_SCHEMA },
  ),

  // Stage 2: verify this page's claims as soon as the page is scanned, one
  // verifier per batch. No barrier: page B is still scanning while page A's
  // claims are being checked.
  (scan, file) => {
    if (!scan) throw new Error(`scan of ${file} returned nothing`) // drops the page to null: reported below
    return parallel(
      batches(scan.claims).map((batch, b) => () =>
        agent(
          `Check each of these claims from ${file}:\n\n` +
          batch.map((c, i) => `${i + 1}. (line ${c.line}) "${c.claim}"`).join('\n') + '\n\n' +
          `Use the authoritative source for its domain: code.claude.com/docs for Claude Code behavior; ` +
          `the anthropics/claude-code CHANGELOG and the npm dist-tags of @anthropic-ai/claude-code for ` +
          `versions; platform.claude.com/docs for models; claude.com/pricing and support.claude.com plan ` +
          `articles for plans; modelcontextprotocol.io for MCP; docs.github.com for GitHub; a tool's own ` +
          `docs for that tool. Answer stale only if the source shows the claim is wrong today, and ok ` +
          `only if the source confirms it. Otherwise answer unverifiable and say what you checked: the ` +
          `guide cites or cuts claims nobody can verify. Return one verdict per claim, with its number.`,
          { label: `${file} #${b + 1}`, phase: 'Verify', schema: BATCH_SCHEMA },
        ).then(r => batch.map((c, i) => {
          const v = r?.verdicts?.find(x => x.index === i + 1)
          return v ? { file, line: c.line, claim: c.claim, ...v } : { file, line: c.line, claim: c.claim, verdict: 'unchecked' }
        })),
      ),
    ).then(r => r.flat())
  },
)

const all = results.flat().filter(Boolean)
const unchecked = all.filter(r => r.verdict === 'unchecked')
const checked = all.filter(r => r.verdict !== 'unchecked')
const failedPages = pages.filter((_, i) => results[i] === null)
if (unchecked.length || failedPages.length) {
  log(`Not checked: ${unchecked.length} claim(s) whose verifier returned no verdict, and ${failedPages.length} page(s) whose scan failed.`)
}
const byPlace = (a, b) => a.file.localeCompare(b.file) || a.line - b.line
const sorted = verdict => checked.filter(r => r.verdict === verdict).sort(byPlace)
const stale = sorted('stale')
const unverifiable = sorted('unverifiable')
const ok = sorted('ok')

log(`${checked.length} claim(s) checked: ${stale.length} stale, ${unverifiable.length} unverifiable, ${ok.length} ok.`)

const where = r => `\`${r.file}:${r.line}\``
const issueBody = [
  '## Stale-docs audit',
  '',
  `Audited ${pages.length} page(s) and ${checked.length} claim(s): ${stale.length} stale, ${unverifiable.length} unverifiable, ${ok.length} ok.`,
  '',
  bucket('Stale', stale, r => `- ${where(r)}: "${r.claim}". ${r.reason}${r.source ? ` Source: ${r.source}` : ''}${r.correction ? ` Suggested: ${r.correction}` : ''}`),
  ...(unchecked.length || failedPages.length ? [bucket('Not checked (rerun these)', [
    ...failedPages.map(p => ({ page: p })),
    ...unchecked.sort(byPlace),
  ], r => r.page ? `- \`${r.page}\`: the scan failed` : `- ${where(r)}: "${r.claim}"`)] : []),
  bucket('Unverifiable', unverifiable, r => `- ${where(r)}: "${r.claim}". ${r.reason}${r.source ? ` Checked: ${r.source}` : ''}`),
  '### Ok',
  '',
  ok.length ? `<details><summary>${ok.length} claim(s) confirmed</summary>\n\n${ok.map(r => `- ${where(r)}: ${r.source ?? ''}`).join('\n')}\n\n</details>\n` : 'None.\n',
].join('\n')

return {
  pagesAudited: pages.length,
  claimsChecked: checked.length,
  counts: { stale: stale.length, unverifiable: unverifiable.length, ok: ok.length, unchecked: unchecked.length, failedPages: failedPages.length },
  issueBody,
}
