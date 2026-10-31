// Run with: /migrate-paths on <folder>
export const meta = {
  name: 'migrate-paths',
  description: 'Move a folder from fileURLToPath(import.meta.url) to import.meta.dirname, and confirm each file still passes its tests',
}

const folder = Array.isArray(args) ? args[0] : args
if (!folder) throw new Error('Name a folder: Run /migrate-paths on <folder>')

const found = await agent(`List every file under ${folder}/ that uses import.meta.url, each as a path from the repository root.`, {
  schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
})
const migrated = await pipeline(found.files, (file) =>
  agent(`In ${file}, replace dirname(fileURLToPath(import.meta.url)) with import.meta.dirname and drop imports nothing uses any more.`, { label: file }),
)
const checked = await pipeline(migrated.filter(Boolean), (change) =>
  agent(`Read this change, run npm test, and reply CONFIRMED or BROKEN, with the reason.\n${change}`, { label: 'check' }),
)

return checked.filter(Boolean).join('\n')
