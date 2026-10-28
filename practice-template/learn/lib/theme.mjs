// Colors, glyphs and emoji, by what the terminal can show. Every color comes
// with a symbol or a word, so meaning survives NO_COLOR and color blindness.

// Each token: a 256-color index, then the 16-color foreground code (a
// background adds 10). On the usual dark background, text and pills reach
// 4.5:1 contrast and other marks 3:1.
export const COLORS = {
  accent: [213, 95], accentBg: [127, 95],
  key: [81, 96], code: [117, 96], codeBg: [236, 90], prompt: [248, 37],
  ok: [78, 92], okBg: [29, 32], warn: [221, 93], bad: [203, 91],
  text: [252, 37], white: [231, 97], muted: [245, 90], faint: [242, 90],
  chipBg: [238, 90], gold: [220, 93], dimBg: [239, 90], dimText: [252, 37],
  guidedBg: [26, 34], guided: [75, 94], hintedBg: [98, 35], hinted: [141, 95],
  challengeBg: [202, 33], challenge: [209, 33], black: [16, 30],
  heat2: [111, 94], heat4: [177, 95],
  // Pip's own: the pip-terminal package's 256-color picks; in 16 colors,
  // ones that keep its purple and yellow apart.
  pipOutline: [177, 95], pipEyes: [221, 93], pipMouth: [255, 97],
};

const UNICODE_GLYPHS = {
  rule: '─', bold: '━', rail: '│', bar: '▌', tl: '╭', tr: '╮', bl: '╰', br: '╯',
  check: '✔', warnMark: '▲', pointer: '❯', arrow: '➜', right: '▸', star: '★', starOff: '☆',
  dot: '●', dotOff: '○', diamond: '◆', diamondOff: '◇', ellipsis: '…', bullet: '·', up: '↑↓', sides: '←→',
  // A trail stop's pops: a ring as a card enters, a spark as its step passes.
  // A new "Not yet" mark pops from hollow.
  ring: '◉', spark: '✦', warnPop: '△',
  // A code line's next rows, where it is wider than the card.
  wrap: '↳',
  // The spinner's frames (spec 3.5). It turns only with motion, so ASCII
  // has none.
  spinner: '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏',
};
const ASCII_GLYPHS = {
  rule: '-', bold: '=', rail: '|', bar: '|', tl: '+', tr: '+', bl: '+', br: '+',
  check: '[x]', warnMark: '!', pointer: '>', arrow: '->', right: '>', star: '*', starOff: '.',
  dot: '#', dotOff: 'o', diamond: '+', diamondOff: '+', ellipsis: '...', bullet: '|', up: 'up/down', sides: '<- ->',
  ring: '@', spark: '*', warnPop: '!', wrap: '+',
};

// One job each. ASCII mode drops some and spells others out.
const EMOJI = {
  wave: ['👋', ''], terminal: ['💻', '[TERMINAL]'], claude: ['💬', '[CLAUDE CODE]'], watch: ['👀', '[..]'],
  verified: ['✅', '[ok]'], guess: ['🤔', '?'], hint: ['💡', 'Hint:'], goal: ['🎯', 'Goal:'], safety: ['🔒', 'Safety:'],
  self: ['🙋', '[you]'], level: ['🚀', '>>'], fire: ['🔥', '**'], party: ['🎉', '***'], badge: ['🏅', '[badge]'],
  cup: ['🏆', '[cup]'], map: ['🧭', ''], broken: ['🚧', '[!!]'], editor: ['📝', '[EDITOR]'], browser: ['🌐', '[BROWSER]'],
  payoff: ['🏁', '[win]'], read: ['📖', '[read]'],
};

export function theme(caps) {
  const { depth, unicode } = caps;
  const sgr = (code) => `\x1b[${code}m`;
  const color = (token, bg = false) => {
    const [i256, i16] = COLORS[token];
    if (depth >= 8) return `${bg ? 48 : 38};5;${i256}`;
    return String(bg ? i16 + 10 : i16);
  };
  const fg = (token, s) => (depth > 1 && s ? `${sgr(color(token))}${s}${sgr(39)}` : s);
  const bg = (token, s) => (depth > 1 && s ? `${sgr(color(token, true))}${s}${sgr(49)}` : s);
  const bold = (s) => (s ? `${sgr(1)}${s}${sgr(22)}` : s);
  const inverse = (s) => (s ? `${sgr(7)}${s}${sgr(27)}` : s);
  // A label on a colored block. Without color it is inverse video. Pressed,
  // it turns inverse: without color, where it is inverse already, plain.
  const pill = (text, bgToken, fgToken = 'white', { pressed = false } = {}) => {
    if (depth <= 1) return pressed ? bold(` ${text} `) : inverse(bold(` ${text} `));
    const block = `${sgr(`1;${color(fgToken)};${color(bgToken, true)}`)} ${text} ${sgr('22;39;49')}`;
    return pressed ? inverse(block) : block;
  };
  const glyph = unicode ? UNICODE_GLYPHS : ASCII_GLYPHS;
  const emoji = (name) => EMOJI[name][unicode ? 0 : 1];
  // An emoji and a space, or the ASCII word and a space, or nothing.
  const lead = (name) => (emoji(name) ? `${emoji(name)} ` : '');
  const link = (text, url) => (caps.links && url ? `\x1b]8;;${url}\x07${text}\x1b]8;;\x07` : text);
  // 24-bit color: where the detailed Pip draws, and breathes.
  const truecolor = depth >= 24;
  return { caps, fg, bg, bold, inverse, pill, glyph, emoji, lead, link, unicode, depth, truecolor };
}

export const TIER_STYLE = {
  guided: { label: 'GUIDED', stars: [1, 3], bg: 'guidedBg', tint: 'guided', fgOnBg: 'white', on: 'dot', off: 'dotOff' },
  hinted: { label: 'HINTED', stars: [2, 3], bg: 'hintedBg', tint: 'hinted', fgOnBg: 'white', on: 'diamond', off: 'diamondOff' },
  challenge: { label: 'CHALLENGE', stars: [3, 3], bg: 'challengeBg', tint: 'challenge', fgOnBg: 'black', on: 'star', off: 'starOff' },
};

// A tier's label and stars. While a level-up lands, `landing` draws the stars
// the tier adds over `landing.from` as `landing.glyph`.
export function tierLabel(t, tier, landing) {
  const s = TIER_STYLE[tier];
  const old = landing ? TIER_STYLE[landing.from].stars[0] : s.stars[0];
  const stars = t.glyph.star.repeat(old) + (landing?.glyph ?? t.glyph.star).repeat(s.stars[0] - old) + t.glyph.starOff.repeat(s.stars[1] - s.stars[0]);
  return `${s.label} ${stars}`;
}

export const tierPill = (t, tier, landing) => t.pill(tierLabel(t, tier, landing), TIER_STYLE[tier].bg, TIER_STYLE[tier].fgOnBg);
