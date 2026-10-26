// Reads the colour and motion tokens out of tokens.css, the way the browser
// resolves them, so tests can measure what ships.

export type Rgb = readonly [number, number, number];
export type Theme = "dark" | "light";

/** The body of the first `{ ... }` block that follows `opener`, braces balanced. */
export function block(css: string, opener: string): string {
  const start = css.indexOf(opener);
  if (start === -1) throw new Error(`tokens.css has no ${opener}`);
  const open = css.indexOf("{", start + opener.length - 1);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${opener} is never closed`);
}

/** Custom properties declared at the top level of a block, nested blocks left out. */
export function declarations(body: string): Map<string, string> {
  let flat = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0) flat += ch;
  }
  const found = new Map<string, string>();
  const stripped = flat.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of stripped.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    // Values may be wrapped over several lines; read them as one.
    if (name !== undefined && value !== undefined)
      found.set(
        name,
        value
          .replace(/\s+/g, " ")
          .replace(/\( /g, "(")
          .replace(/ \)/g, ")")
          .trim(),
      );
  }
  return found;
}

function hex(value: string): Rgb | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  const digits = m?.[1];
  if (digits === undefined) return undefined;
  const full = digits.length === 3 ? digits.replace(/./g, "$&$&") : digits;
  const channel = (at: number) => parseInt(full.slice(at, at + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

/** `color-mix(in srgb, a p%, b)`: a straight per-channel mix, rounded as the browser does. */
export function mix(a: Rgb, b: Rgb, weightOfA: number): Rgb {
  const channel = (x: number, y: number) =>
    Math.round(x * weightOfA + y * (1 - weightOfA));
  return [channel(a[0], b[0]), channel(a[1], b[1]), channel(a[2], b[2])];
}

/** Resolves a colour token to sRGB through var() and color-mix(), as tokens.css writes them. */
export function resolveColor(
  tokens: ReadonlyMap<string, string>,
  name: string,
  seen: string[] = [],
): Rgb {
  if (seen.includes(name)) throw new Error(`${name} refers to itself`);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`No token ${name}`);
  const direct = hex(value);
  if (direct) return direct;
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (ref?.[1] !== undefined)
    return resolveColor(tokens, ref[1], [...seen, name]);
  const m =
    /^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+([\d.]+)%,\s*var\((--[\w-]+)\)\)$/.exec(
      value,
    );
  if (m?.[1] !== undefined && m[2] !== undefined && m[3] !== undefined) {
    return mix(
      resolveColor(tokens, m[1], [...seen, name]),
      resolveColor(tokens, m[3], [...seen, name]),
      Number(m[2]) / 100,
    );
  }
  throw new Error(`${name}: cannot measure ${value}`);
}

/** WCAG 2.2 relative luminance of an sRGB colour. */
export function luminance(rgb: Rgb): number {
  const linear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
  );
}

/** WCAG 2.2 contrast ratio between two colours, from 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every token for each theme: the @theme defaults (dark), with the light variant laid over them. */
export function themes(css: string): Record<Theme, Map<string, string>> {
  const dark = declarations(block(css, "@theme static {"));
  const root = block(css, "\n:root {");
  const light = new Map([
    ...dark,
    ...declarations(block(root, "@variant light {")),
  ]);
  return { dark, light };
}

/** The tokens the reduced-motion variant overrides. */
export function reducedMotion(css: string): Map<string, string> {
  return declarations(block(block(css, "\n:root {"), "@variant reduced {"));
}

/** The motion tokens declared on :root for full motion. */
export function fullMotion(css: string): Map<string, string> {
  return declarations(block(css, "\n:root {"));
}
