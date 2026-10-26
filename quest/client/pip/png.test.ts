// @vitest-environment node
// The PNG helpers pip:build makes the transparent posters with, and the
// contract test compares frames with.
import { describe, expect, test } from "vitest";
import {
  changedShare,
  decodePng,
  drawnBounds,
  encodePng,
  eyes,
  largestDifference,
  matte,
  over,
  pngSize,
  soles,
  type Rgba,
} from "./png.ts";

function image(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
}

// A gradient with every alpha level, so each PNG filter gets used.
const sample = image(37, 23, (x, y) => [
  (x * 7) % 256,
  (y * 11) % 256,
  (x * y) % 256,
  (x * 13 + y * 5) % 256,
]);

describe("PNG", () => {
  test("decodes what it encodes, byte for byte", () => {
    const back = decodePng(encodePng(sample));
    expect(back.width).toBe(sample.width);
    expect(back.height).toBe(sample.height);
    expect(Buffer.from(back.data).equals(Buffer.from(sample.data))).toBe(true);
  });

  test("encodes the same pixels to the same bytes", () => {
    expect(encodePng(sample).equals(encodePng(sample))).toBe(true);
  });

  test("reads the size from the header", () => {
    expect(pngSize(encodePng(sample))).toEqual({ width: 37, height: 23 });
  });

  test("refuses what is not a PNG", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(
      "not a PNG",
    );
    expect(() => pngSize(new Uint8Array(32))).toThrow("not a PNG");
  });
});

describe("matte", () => {
  // A colour at some coverage, as captured over black and over white.
  const colour = [200, 120, 40] as const;
  const coverage = (x: number) => [0, 0.25, 0.5, 1][x % 4] ?? 0;
  const capture = (background: number) =>
    image(8, 2, (x) => {
      const a = coverage(x);
      const [r, g, b] = colour.map((c) =>
        Math.round(c * a + background * (1 - a)),
      ) as [number, number, number];
      return [r, g, b, 255];
    });

  test("recovers each pixel's coverage and colour from captures over black and white", () => {
    const poster = matte(capture(0), capture(255));
    for (let x = 0; x < 8; x++) {
      const i = x * 4;
      const a = coverage(x);
      expect(Math.abs((poster.data[i + 3] ?? 0) - a * 255)).toBeLessThanOrEqual(
        1,
      );
      if (a > 0)
        for (let ch = 0; ch < 3; ch++)
          expect(
            Math.abs((poster.data[i + ch] ?? 0) - (colour[ch] ?? 0)),
          ).toBeLessThanOrEqual(2);
    }
  });

  test("composites back over any background to what a capture there shows", () => {
    const poster = matte(capture(0), capture(255));
    expect(
      largestDifference(over(poster, [29, 29, 29]), capture(29)),
    ).toBeLessThanOrEqual(2);
  });
});

describe("changedShare", () => {
  test("counts the pixels that differ beyond the tolerance", () => {
    const a = image(10, 10, () => [10, 10, 10, 255]);
    const b = image(10, 10, (x) =>
      x < 3 ? [40, 10, 10, 255] : [14, 10, 10, 255],
    );
    expect(changedShare(a, b)).toBeCloseTo(0.3);
    expect(changedShare(a, a)).toBe(0);
  });
});

describe("drawnBounds", () => {
  test("boxes everything darker than near-white, and nothing on a blank image", () => {
    const drawn = image(12, 9, (x, y) =>
      (x === 3 && y === 2) || (x === 8 && y === 6)
        ? [200, 120, 40, 255]
        : x === 10 && y === 1
          ? [245, 245, 245, 255]
          : [255, 255, 255, 255],
    );
    expect(drawnBounds(drawn)).toEqual({
      top: 2,
      bottom: 6,
      left: 3,
      right: 8,
    });
    expect(drawnBounds(image(4, 4, () => [255, 255, 255, 255]))).toBeNull();
  });
});

describe("eyes", () => {
  test("counts and centres the near-black pixels, and finds none on a blank image", () => {
    const drawn = image(10, 6, (x, y) =>
      (x === 2 || x === 6) && y >= 1 && y <= 4
        ? [20, 11, 15, 255]
        : x === 8
          ? [120, 60, 40, 255]
          : [255, 255, 255, 255],
    );
    expect(eyes(drawn)).toEqual({ pixels: 8, x: 4, y: 2.5 });
    expect(eyes(image(4, 4, () => [255, 255, 255, 255]))).toBeNull();
  });
});

describe("soles", () => {
  test("finds the lowest warm row, never a grey shadow below it, and none on a blank image", () => {
    const drawn = image(8, 8, (x, y) =>
      y === 6
        ? [120, 120, 120, 255]
        : y >= 2 && y <= 4 && x >= 2 && x <= 5
          ? [180, 72, 47, 255]
          : [255, 255, 255, 255],
    );
    expect(soles(drawn)).toBe(4);
    expect(soles(image(4, 4, () => [255, 255, 255, 255]))).toBeNull();
  });
});
