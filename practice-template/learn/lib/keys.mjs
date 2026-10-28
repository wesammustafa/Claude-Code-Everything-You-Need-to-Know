// Raw terminal input to key events. A bracketed paste arrives as one event,
// so a command pasted into this window is caught, not run as keys. An escape
// sequence split across reads is held until it completes; flush() releases a
// lone Escape the terminal sent on its own.
const SEQUENCES = {
  '\x1b[A': 'up', '\x1bOA': 'up', '\x1b[B': 'down', '\x1bOB': 'down',
  '\x1b[C': 'right', '\x1bOC': 'right', '\x1b[D': 'left', '\x1bOD': 'left',
  '\r': 'enter', '\n': 'enter', '\r\n': 'enter', ' ': 'space', '\t': 'tab',
  '\x7f': 'backspace', '\b': 'backspace', '\x03': 'ctrl-c', '\x04': 'ctrl-d',
};
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const PASTE_MAX = 10_000;
// The start of an escape sequence that more input may complete.
const PARTIAL = /^\x1b(\[[0-9;?]*|O)?$/;

export function keyParser() {
  let paste = null;
  let held = '';
  const parse = (chunk) => {
    const events = [];
    let rest = held + chunk;
    held = '';
    while (rest.length) {
      if (paste !== null) {
        const all = paste + rest;
        const end = all.indexOf(PASTE_END);
        if (end !== -1) {
          events.push({ type: 'paste', text: all.slice(0, end) });
          paste = null;
          rest = all.slice(end + PASTE_END.length);
          continue;
        }
        // Ctrl+C always works, even inside a paste that never ends.
        if (rest.includes('\x03')) {
          paste = null;
          events.push({ type: 'key', name: 'ctrl-c' });
          rest = rest.slice(rest.indexOf('\x03') + 1);
          continue;
        }
        paste = all.length > PASTE_MAX ? all.slice(-PASTE_MAX) : all;
        rest = '';
        continue;
      }
      if (rest.startsWith(PASTE_START)) {
        paste = '';
        rest = rest.slice(PASTE_START.length);
        continue;
      }
      const seq = Object.keys(SEQUENCES).filter((k) => rest.startsWith(k)).sort((a, b) => b.length - a.length)[0];
      if (seq) {
        const name = SEQUENCES[seq];
        events.push({ type: 'key', name, ch: name === 'space' ? ' ' : undefined });
        rest = rest.slice(seq.length);
        continue;
      }
      if (rest[0] === '\x1b') {
        if (PARTIAL.test(rest) || PASTE_START.startsWith(rest)) {
          held = rest;
          break;
        }
        if (rest.startsWith('\x1b\x1b')) {
          events.push({ type: 'key', name: 'escape' });
          rest = rest.slice(1);
          continue;
        }
        // An escape sequence this app doesn't use: skip it whole.
        const m = rest.match(/^\x1b(\[[0-9;?]*[ -/]*[@-~]|O.|.)/s);
        rest = rest.slice(m ? m[0].length : 1);
        continue;
      }
      const [ch] = rest;
      rest = rest.slice(ch.length);
      if (ch < ' ') continue;
      events.push({ type: 'key', name: ch.length === 1 && /[a-z?]/.test(ch) ? ch : ch.toLowerCase(), ch });
    }
    // Several printable characters in one read, perhaps ending in Enter, is a
    // paste from a terminal that doesn't bracket pastes.
    const printable = events.filter((e) => e.type === 'key' && e.ch);
    const trailing = events.slice(printable.length);
    if (printable.length >= 3 && events.slice(0, printable.length).every((e) => e.ch) && trailing.every((e) => e.name === 'enter')) {
      return [{ type: 'paste', text: printable.map((e) => e.ch).join('') }];
    }
    return events;
  };
  parse.pending = () => held !== '';
  parse.flush = () => {
    const out = held === '\x1b' ? [{ type: 'key', name: 'escape' }] : [];
    held = '';
    return out;
  };
  return parse;
}
