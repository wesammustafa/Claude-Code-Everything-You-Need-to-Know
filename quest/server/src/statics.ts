// The static files and pages: read once at start from the build's own list,
// served only by that name. Nothing here maps a URL to the file system.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

/** One file the build lists: its URL path, its file under the bundle's folder, its type and whether its name is hashed. */
export interface StaticEntry {
  path: string;
  file: string;
  type: string;
  immutable: boolean;
}

export type Encoding = "br" | "gzip";

export interface StaticFile {
  bytes: Buffer<ArrayBuffer>;
  type: string;
  immutable: boolean;
  /** Each encoding's bytes, made on the first request for it, or null where it is no smaller. */
  encoded: Map<Encoding, Promise<Buffer<ArrayBuffer> | null>>;
}

export type Statics = ReadonlyMap<string, StaticFile>;

// Already compressed: compressing again only spends time.
const PACKED = new Set(["image/png", "font/woff2"]);

export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
export const PAGE_CACHE = "no-cache";

/** Reads exactly the listed files under `dir`. A listed file that is missing throws. */
export function loadStatics(
  dir: string,
  table: readonly StaticEntry[],
): Statics {
  const statics = new Map<string, StaticFile>();
  for (const entry of table) {
    statics.set(entry.path, {
      bytes: readFileSync(join(dir, entry.file)),
      type: entry.type,
      immutable: entry.immutable,
      encoded: new Map(),
    });
  }
  return statics;
}

/** Whether a file of this type is worth compressing, and so varies by Accept-Encoding. */
export function compressible(type: string): boolean {
  return !PACKED.has(type);
}

/**
 * The encoding to send for an Accept-Encoding header: Brotli, then gzip,
 * else none. A coding with q=0 is refused, and `*` stands for any coding
 * the header does not name.
 */
export function pickEncoding(accept: string | undefined): Encoding | null {
  const q = new Map<string, number>();
  for (const part of (accept ?? "").split(",")) {
    const [name = "", ...params] = part.trim().toLowerCase().split(";");
    if (!name) continue;
    const weight = params
      .map((param) => /^\s*q\s*=\s*([\d.]+)\s*$/.exec(param)?.[1])
      .find((value) => value !== undefined);
    q.set(name, weight === undefined ? 1 : Number(weight));
  }
  for (const coding of ["br", "gzip"] as const) {
    const weight = q.get(coding) ?? q.get("*") ?? 0;
    if (weight > 0) return coding;
  }
  return null;
}

const brotli = promisify(brotliCompress);
const gzipped = promisify(gzip);

function compress(
  bytes: Buffer<ArrayBuffer>,
  encoding: Encoding,
): Promise<Buffer<ArrayBuffer>> {
  return encoding === "br"
    ? brotli(bytes, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 5,
          [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
        },
      })
    : gzipped(bytes, { level: 6 });
}

/**
 * The file's bytes in `encoding`, compressed on the first request and kept
 * in memory; concurrent first requests share the work. Null where the
 * compressed copy is no smaller, or compressing failed.
 */
export function encoded(
  file: StaticFile,
  encoding: Encoding,
): Promise<Buffer<ArrayBuffer> | null> {
  let pending = file.encoded.get(encoding);
  if (!pending) {
    pending = compress(file.bytes, encoding).then(
      (out) => (out.length < file.bytes.length ? out : null),
      () => null,
    );
    file.encoded.set(encoding, pending);
  }
  return pending;
}
