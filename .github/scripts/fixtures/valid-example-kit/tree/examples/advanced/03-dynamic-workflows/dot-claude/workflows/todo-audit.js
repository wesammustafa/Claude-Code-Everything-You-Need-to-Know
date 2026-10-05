export const meta = { name: 'todo-audit', description: 'List TODOs per folder' }
const folders = args?.folders ?? ['src']
const reports = await Promise.all(folders.map((f) => agent(`List TODOs in ${f}`)))
return reports.join('\n')
