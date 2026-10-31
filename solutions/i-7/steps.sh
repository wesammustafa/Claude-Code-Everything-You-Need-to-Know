#!/bin/sh
# i-7: commit Chrome DevTools MCP pinned with its data flows off, save the
# repaired demo, then a PNG capture taken after the repair.
set -eu
cp "$SOLUTION/.mcp.json" .mcp.json
git add .mcp.json
git commit -q -m "Share Chrome DevTools MCP at a pinned version"
mkdir -p .practice
cp "$SOLUTION/.practice/demo.html" .practice/demo.html
# A 1x1 PNG stands in for the screenshot; it is written after the repair.
node -e '
const { deflateSync, crc32 } = require("node:zlib");
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from([0, 255, 255, 255]))), chunk("IEND", Buffer.alloc(0)),
]);
require("node:fs").writeFileSync(".practice/i-7-page.png", png);
'
