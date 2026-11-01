import assert from 'node:assert/strict';
import test from 'node:test';
import { shellNotFound } from '../command.mjs';

test('a command the shell could not find is told apart from one that failed', () => {
  assert.equal(shellNotFound({ status: 9009, stderr: '' }), true, 'cmd.exe');
  assert.equal(shellNotFound({ status: 1, stderr: "'claude' is not recognized as an internal or external command,\r\n" }), true, 'cmd.exe through npm');
  assert.equal(shellNotFound({ status: 127, stderr: 'bash: claude: command not found' }), true, 'a POSIX shell');
  assert.equal(shellNotFound({ status: 1, stderr: 'Error: not signed in' }), false, 'claude ran and failed');
  assert.equal(shellNotFound({ status: 0, stderr: '' }), false);
});
