// isStub recognises every listed Stub, and a page that only mentions a move
// further down is not one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUBS, isStub } from '../lib/stamps.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('every STUBS entry reads as a Stub', () => {
  for (const path of STUBS) assert.ok(isStub(readFileSync(join(root, path), 'utf8')), path);
});

test('both Stub openings count, and nothing else does', () => {
  assert.ok(isStub('# A\n\nThis page moved. See [B](b.md).\n'));
  assert.ok(isStub('<a id="x"></a>\n# A\n\nThis maintainer-only page moved into local configuration.\n'));
  assert.ok(!isStub('# A\n\nVerified against Claude Code v2.1.0 (stable) on 2026-01-01\n\nThis page moved.\n'));
  assert.ok(!isStub('No heading. This page moved.\n'));
});
