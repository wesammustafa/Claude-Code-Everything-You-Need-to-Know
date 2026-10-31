// Run with: /audit-dropped-errors on <folder>
export const meta = {
  name: 'audit-dropped-errors',
  description: 'Audit a folder for errors that are caught and then ignored, and report only the findings a second agent confirms',
}

const folder = Array.isArray(args) ? args[0] : args
if (!folder) throw new Error('Name a folder: Run /audit-dropped-errors on <folder>')

const found = await agent(`List every file under ${folder}/, each as a path from the repository root.`, {
  schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
})
const findings = await pipeline(found.files, (file) =>
  agent(`In ${file}, find each error that is caught and then ignored. Give each as path:line and why.`, { label: file }),
)
const confirmed = await pipeline(findings.filter(Boolean), (finding) =>
  agent(`Try to refute this finding by reading the code. Reply CONFIRMED or REFUTED, with the reason.\n${finding}`, { label: 'check' }),
)

return confirmed.filter(Boolean).join('\n')
