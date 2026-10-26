// Just enough PNG for `npm run pip:build`: reading the Rive CLI's captures
// (8-bit RGBA, not interlaced) and writing the posters. Node's zlib does the
// compression, so no image package is needed.
import { deflateSync, inflateSync } from "node:zlib";

export interface Rgba {
  width: number;
  height: number;
  /** Four bytes per pixel, row by row, not premultiplied. */
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** A PNG's size in pixels, read from its header alone. */
export function pngSize(file: Uint8Array): { width: number; height: number } {
  const bytes = Buffer.from(file);
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(SIGNATURE) ||
    bytes.toString("latin1", 12, 16) !== "IHDR"
  )
    throw new Error("not a PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * Decodes an 8-bit RGBA or RGB PNG that is not interlaced: what the Rive CLI
 * writes, and what a browser screenshot is. RGB comes back opaque.
 */
export function decodePng(file: Uint8Array): Rgba {
  const bytes = Buffer.from(file);
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");
  let width = 0;
  let height = 0;
  let channels = 4;
  const idat: Buffer[] = [];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("latin1", at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || (colour !== 6 && colour !== 2) || interlace !== 0) {
        throw new Error(
          `only 8-bit RGBA or RGB PNGs without interlacing are read here (depth ${String(depth)}, colour type ${String(colour)}, interlace ${String(interlace)})`,
        );
      }
      channels = colour === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels;
      const a = left ? (rows[y * stride + x - channels] ?? 0) : 0;
      const b = y > 0 ? (rows[(y - 1) * stride + x] ?? 0) : 0;
      const c =
        left && y > 0 ? (rows[(y - 1) * stride + x - channels] ?? 0) : 0;
      const v = line[x] ?? 0;
      const predicted =
        filter === 0
          ? 0
          : filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? (a + b) >> 1
                : filter === 4
                  ? paeth(a, b, c)
                  : Number.NaN;
      if (Number.isNaN(predicted))
        throw new Error(`unknown PNG filter ${String(filter)}`);
      rows[y * stride + x] = (v + predicted) & 0xff;
    }
  }
  if (channels === 4) return { width, height, data: rows };
  const data = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    data.set(rows.subarray(p * 3, p * 3 + 3), p * 4);
    data[p * 4 + 3] = 255;
  }
  return { width, height, data };
}

function chunk(type: string, body: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/**
 * Encodes RGBA as a PNG, choosing each row's filter by the smallest sum of
 * absolute differences (the usual heuristic), then deflating at the highest
 * level. The same pixels always give the same bytes.
 */
export function encodePng(image: Rgba): Buffer {
  const { width, height, data } = image;
  const stride = width * 4;
  const filtered = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    let best = -1;
    let bestScore = Infinity;
    let bestRow = Buffer.alloc(stride);
    for (let filter = 0; filter <= 4; filter++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const v = data[y * stride + x] ?? 0;
        const a = x >= 4 ? (data[y * stride + x - 4] ?? 0) : 0;
        const b = y > 0 ? (data[(y - 1) * stride + x] ?? 0) : 0;
        const c = x >= 4 && y > 0 ? (data[(y - 1) * stride + x - 4] ?? 0) : 0;
        const predicted =
          filter === 0
            ? 0
            : filter === 1
              ? a
              : filter === 2
                ? b
                : filter === 3
                  ? (a + b) >> 1
                  : paeth(a, b, c);
        const out = (v - predicted) & 0xff;
        candidate[x] = out;
        score += out < 128 ? out : 256 - out;
      }
      if (score < bestScore) {
        bestScore = score;
        best = filter;
        bestRow = Buffer.from(candidate);
      }
    }
    filtered[y * (stride + 1)] = best;
    bestRow.copy(filtered, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(filtered, { level: 9, memLevel: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/**
 * Recovers a transparent image from two opaque captures of the same frame, one
 * over black and one over white (difference matting): a pixel's coverage is
 * one minus how far apart the two backgrounds left it, and its colour is the
 * black capture divided by that coverage.
 */
export function matte(overBlack: Rgba, overWhite: Rgba): Rgba {
  const { width, height } = overBlack;
  if (overWhite.width !== width || overWhite.height !== height)
    throw new Error("the two captures differ in size");
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    let gap = 0;
    for (let ch = 0; ch < 3; ch++)
      gap += (overWhite.data[i + ch] ?? 0) - (overBlack.data[i + ch] ?? 0);
    const alpha = Math.min(1, Math.max(0, 1 - gap / 3 / 255));
    const a8 = Math.round(alpha * 255);
    if (a8 === 0) continue;
    for (let ch = 0; ch < 3; ch++) {
      const value = (overBlack.data[i + ch] ?? 0) / (a8 / 255);
      out[i + ch] = Math.min(255, Math.round(value));
    }
    out[i + 3] = a8;
  }
  return { width, height, data: out };
}

/** The image drawn over an opaque background colour, as a browser composites it. */
export function over(
  image: Rgba,
  background: readonly [number, number, number],
): Rgba {
  const out = new Uint8Array(image.data.length);
  for (let i = 0; i < out.length; i += 4) {
    const alpha = (image.data[i + 3] ?? 0) / 255;
    for (let ch = 0; ch < 3; ch++) {
      out[i + ch] = Math.round(
        (image.data[i + ch] ?? 0) * alpha + (background[ch] ?? 0) * (1 - alpha),
      );
    }
    out[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data: out };
}

/** The largest difference in any colour channel between two images of the same size. */
export function largestDifference(a: Rgba, b: Rgba): number {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error("the images differ in size");
  let largest = 0;
  for (let i = 0; i < a.data.length; i++) {
    if (i % 4 === 3) continue;
    largest = Math.max(largest, Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0)));
  }
  return largest;
}

export interface Bounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The share of pixels (0 to 1) whose colour differs by more than `tolerance`
 * in some channel: of the whole image, or of the box `within` (inclusive).
 */
export function changedShare(
  a: Rgba,
  b: Rgba,
  tolerance = 8,
  within?: Bounds,
): number {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error("the images differ in size");
  const box = within ?? {
    top: 0,
    bottom: a.height - 1,
    left: 0,
    right: a.width - 1,
  };
  let changed = 0;
  for (let y = box.top; y <= box.bottom; y++) {
    for (let x = box.left; x <= box.right; x++) {
      const i = (y * a.width + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        if (
          Math.abs((a.data[i + ch] ?? 0) - (b.data[i + ch] ?? 0)) > tolerance
        ) {
          changed++;
          break;
        }
      }
    }
  }
  return changed / ((box.bottom - box.top + 1) * (box.right - box.left + 1));
}

/**
 * The box around everything drawn on an image captured over white: the first
 * and last rows and columns holding a pixel darker than near-white. Null when
 * nothing is drawn.
 */
export function drawnBounds(image: Rgba): Bounds | null {
  let bounds: Bounds | null = null;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const sum =
        (image.data[i] ?? 255) +
        (image.data[i + 1] ?? 255) +
        (image.data[i + 2] ?? 255);
      if (sum >= 3 * 240) continue;
      if (!bounds) bounds = { top: y, bottom: y, left: x, right: x };
      bounds.bottom = y;
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
    }
  }
  return bounds;
}

/**
 * Pip's eyes on an image captured over white: how many pixels are near-black
 * (the eyes are the darkest part of Pip), and their centre. Null when there
 * are none.
 */
export function eyes(
  image: Rgba,
): { pixels: number; x: number; y: number } | null {
  let sx = 0;
  let sy = 0;
  let pixels = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const sum =
      (image.data[i] ?? 255) +
      (image.data[i + 1] ?? 255) +
      (image.data[i + 2] ?? 255);
    if (sum >= 3 * 48) continue;
    const p = i / 4;
    sx += p % image.width;
    sy += Math.floor(p / image.width);
    pixels++;
  }
  return pixels === 0 ? null : { pixels, x: sx / pixels, y: sy / pixels };
}

/**
 * The row where Pip's feet meet the floor on an image captured over white:
 * the lowest row holding a warm, saturated pixel (red well above green). Pip's
 * soles are its lowest coloured part, and its ground shadow is grey, so the
 * shadow never counts. Null when there is none.
 */
export function soles(image: Rgba): number | null {
  for (let y = image.height - 1; y >= 0; y--) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if ((image.data[i] ?? 0) - (image.data[i + 1] ?? 0) > 40) return y;
    }
  }
  return null;
}

/**
 * The box around the pixels within `tolerance` of the colour `rgb` in every
 * channel, inside the box `within` (inclusive) when given: where a part
 * painted in a marker colour landed. Null when there are none.
 */
export function colourBounds(
  image: Rgba,
  rgb: readonly [number, number, number],
  within?: Bounds,
  tolerance = 24,
): Bounds | null {
  const box = within ?? {
    top: 0,
    bottom: image.height - 1,
    left: 0,
    right: image.width - 1,
  };
  let bounds: Bounds | null = null;
  for (let y = box.top; y <= box.bottom; y++) {
    for (let x = box.left; x <= box.right; x++) {
      const i = (y * image.width + x) * 4;
      if (
        !rgb.every(
          (value, ch) =>
            Math.abs((image.data[i + ch] ?? 0) - value) <= tolerance,
        )
      )
        continue;
      if (!bounds) bounds = { top: y, bottom: y, left: x, right: x };
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = y;
      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
    }
  }
  return bounds;
}
