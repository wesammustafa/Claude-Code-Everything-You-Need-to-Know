// Generated rather than committed: a committed manifest under fixtures/ would
// itself be a marketplace file that the inertness rule doesn't scan.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function generate(root) {
  const dir = join(root, '.claude-plugin');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'marketplace.json'),
    '{ "name": "guide-tools", "owner": { "name": "Guide" }, "plugins": [{ "name": "team-kit", "source": "./examples/advanced/06-share-your-setup/plugins/team-kit" }] }\n',
  );
}
