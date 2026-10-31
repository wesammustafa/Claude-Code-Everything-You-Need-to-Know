// The real version command runs against a tiny executable on a scenario's
// PATH, so failures never depend on the developer's Claude installation.
export const scenarios = [
  { item: 0, name: 'not on PATH', path: 'missing-bin', files: {} },
  { item: 0, name: 'not executable', path: 'bin', files: { 'bin/claude': 'no executable bit\n' } },
  { item: 0, name: 'no output', path: 'bin', command: '#!/bin/sh\nexit 0\n' },
  { item: 0, name: 'malformed version', path: 'bin', command: '#!/bin/sh\nprintf "unknown version\\n"\n' },
  { item: 0, name: 'command fails', path: 'bin', command: '#!/bin/sh\nprintf "installation failed\\n" >&2\nexit 1\n' },
  { item: 1, name: 'wrong folder', files: {} },
  { item: 1, name: 'note removed', files: { 'checks/run.mjs': '' } },
  { item: 1, name: 'claim is still wrong', files: { 'practice/b-1/onboarding.md': '- linkcheck exits 0 when it finds broken links.\n' } },
  { item: 1, name: 'claim omitted', files: { 'practice/b-1/onboarding.md': '- linkcheck checks local links.\n' } },
];
