// Shared by the learn app's screen tests: a small terminal model, an output
// stream the test controls, and a clock with timers that move only when the
// test moves them.
import { EventEmitter } from 'node:events';
import { cellWidth, graphemes } from '../../learn/lib/text.mjs';

// Replays what the app writes into a grid: CSI H, CSI r;cH, CSI K, CSI J,
// CSI 2J, CR, LF and text. Every other escape (colors, modes, links) takes
// no cell. lines() gives each row's text with trailing spaces trimmed.
export function screenModel(cols, rows) {
  const blank = () => Array(cols).fill(' ');
  let grid = Array.from({ length: rows }, blank);
  let r = 0;
  let c = 0;
  const ESC = /^\x1b(?:\[([?0-9;]*)([A-Za-z])|\]8;;[^\x07\x1b]*(?:\x07|\x1b\\))/;
  function feed(bytes) {
    let rest = bytes;
    while (rest.length) {
      const m = rest.match(ESC);
      if (m) {
        rest = rest.slice(m[0].length);
        const [, args = '', cmd] = m;
        if (cmd === 'H') {
          const [row = 1, col = 1] = args.split(';').map((n) => Number(n) || 1);
          [r, c] = [row - 1, col - 1];
        } else if (cmd === 'K') grid[r].fill(' ', c);
        else if (cmd === 'J' && args === '2') grid = Array.from({ length: rows }, blank);
        else if (cmd === 'J') {
          grid[r].fill(' ', c);
          for (let i = r + 1; i < rows; i++) grid[i] = blank();
        }
        continue;
      }
      const [g] = graphemes(rest.slice(0, 8));
      rest = rest.slice(g.length);
      if (g === '\r') c = 0;
      else if (g === '\n') r = Math.min(rows - 1, r + 1);
      else if (g === '\r\n') [r, c] = [Math.min(rows - 1, r + 1), 0];
      else {
        const w = cellWidth(g);
        if (c + w <= cols) {
          grid[r][c] = g;
          if (w === 2) grid[r][c + 1] = '';
        }
        c += w;
      }
    }
  }
  const lines = () => grid.map((row) => row.join('').trimEnd());
  return { feed, lines };
}

// An output stream that keeps every write. `full` makes write() return false,
// as a backlogged stream does, until drain() empties it.
export function fakeOut({ columns = 80, rows = 24 } = {}) {
  const out = new EventEmitter();
  Object.assign(out, {
    isTTY: true, columns, rows, writes: [], full: false,
    write(chunk) {
      out.writes.push(String(chunk));
      return !out.full;
    },
    drain() {
      out.full = false;
      out.emit('drain');
    },
  });
  return out;
}

// A few turns of the event loop: a draw asked for from a microtask queues
// behind this one.
export const turn = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
};

// A clock with timers. advance(ms) runs every timer that falls due, in time
// order, each at its own time, and lets the event loop turn after each one so
// the draws it asks for go out at that time. It reads `from` at first: 0 is
// where performance.now() starts.
export function fakeClock(from = 1_000_000) {
  let time = from;
  let seq = 0;
  const timers = new Map();
  const add = (fn, ms, every) => {
    seq += 1;
    timers.set(seq, { fn, due: time + Math.max(0, ms), every });
    return seq;
  };
  return {
    now: () => time,
    // Time passing inside a call, such as a slow write: no timer runs.
    spend: (ms) => { time += ms; },
    setTimeout: (fn, ms = 0) => add(fn, ms, null),
    setInterval: (fn, ms) => add(fn, ms, ms),
    clearTimeout: (id) => timers.delete(id),
    clearInterval: (id) => timers.delete(id),
    // The timers waiting, as { ms, every } from now.
    pending: () => [...timers.values()].map((x) => ({ ms: x.due - time, every: x.every })),
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        await turn();
        const next = [...timers.entries()].filter(([, x]) => x.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!next) break;
        const [id, x] = next;
        time = x.due;
        if (x.every) x.due += x.every;
        else timers.delete(id);
        x.fn();
      }
      time = end;
      await turn();
    },
  };
}
