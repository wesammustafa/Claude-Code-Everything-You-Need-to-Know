import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A 1x1 lossless WebP built from bytes: an extended file (VP8X with the
// animation flag), an ANIM chunk and two ANMF frames.
// A 1x1 VP8L bitstream: signature 0x2f, then 14-bit width-1 and height-1,
// alpha and version bits, then the image data.
const VP8L = Buffer.from('2f000000100710111188 88fe0700'.replace(/ /g, ''), 'hex');
const chunk = (type, data) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([Buffer.from(type, 'latin1'), size, data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
};
const u24 = (v) => Buffer.from([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff]);
// ANMF: x/2, y/2, width-1, height-1, duration 500 ms, flags, then the frame.
const frame = () => chunk('ANMF', Buffer.concat([u24(0), u24(0), u24(0), u24(0), u24(500), Buffer.from([0]), chunk('VP8L', VP8L)]));

export function build(animated) {
  let body;
  if (animated) {
    // VP8X: flags (0x10 alpha, 0x02 animation), 3 reserved bytes, canvas width-1, height-1.
    const vp8x = chunk('VP8X', Buffer.concat([Buffer.from([0x12, 0, 0, 0]), u24(0), u24(0)]));
    // ANIM: background colour BGRA, loop count 0 (forever).
    const anim = chunk('ANIM', Buffer.from([255, 255, 255, 255, 0, 0]));
    body = Buffer.concat([vp8x, anim, frame(), frame()]);
  } else {
    body = chunk('VP8L', VP8L);
  }
  const size = Buffer.alloc(4);
  size.writeUInt32LE(4 + body.length);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), size, Buffer.from('WEBP', 'latin1'), body]);
}

export default function generate(root) {
  mkdirSync(join(root, 'assets', 'readme'), { recursive: true });
  writeFileSync(join(root, 'assets', 'readme', 'quest-step.webp'), build(true));
}
