import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

// A 1x1 RGBA PNG built from bytes, made an APNG of two frames: acTL before
// IDAT, an fcTL for each frame and the second frame in an fdAT.
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const u32 = (...values) => Buffer.concat(values.map((v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; }));
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
// One scanline: filter byte 0, then one RGBA pixel.
const pixel = (r, g, b) => deflateSync(Buffer.from([0, r, g, b, 255]));
// fcTL: sequence, width, height, x, y, delay 1/2 s, dispose none, blend source.
const fctl = (seq) => chunk('fcTL', Buffer.concat([u32(seq, 1, 1, 0, 0), u16(1), u16(2), Buffer.from([0, 0])]));

export function build(animated) {
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  parts.push(chunk('IHDR', Buffer.concat([u32(1, 1), Buffer.from([8, 6, 0, 0, 0])])));
  if (animated) parts.push(chunk('acTL', u32(2, 0)), fctl(0));
  parts.push(chunk('IDAT', pixel(217, 119, 87)));
  if (animated) parts.push(fctl(1), chunk('fdAT', Buffer.concat([u32(2), pixel(87, 119, 217)])));
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

export default function generate(root) {
  mkdirSync(join(root, 'assets', 'readme'), { recursive: true });
  writeFileSync(join(root, 'assets', 'readme', 'quest-step.png'), build(true));
}
