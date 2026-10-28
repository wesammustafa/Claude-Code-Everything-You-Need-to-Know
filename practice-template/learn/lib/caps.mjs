// What the learner's terminal can show. LEARN_PLAIN=1 or --plain asks for
// plain ASCII with no color, for terminals where the symbols come out wrong;
// LEARN_CALM=1 or --calm keeps the screen still. Neither is saved.
export function unicodeLikely(env = process.env, platform = process.platform) {
  if (platform !== 'win32') return env.TERM !== 'linux';
  // The old Windows console host can't draw emoji or most symbols; these
  // terminals can.
  return Boolean(env.WT_SESSION || env.TERMINUS_SUBLIME || env.ConEmuTask === '{cmd::Cmder}'
    || env.TERM_PROGRAM === 'vscode' || env.TERM === 'xterm-256color' || env.TERM === 'alacritty'
    || env.TERMINAL_EMULATOR === 'JetBrains-JediTerm');
}

export function capabilities(stream = process.stdout, env = process.env, platform = process.platform, argv = []) {
  const calm = env.LEARN_CALM === '1' || argv.includes('--calm');
  const plain = env.LEARN_PLAIN === '1' || argv.includes('--plain');
  const tty = Boolean(stream.isTTY);
  let depth = tty && typeof stream.getColorDepth === 'function' ? stream.getColorDepth(env) : 1;
  if (plain || env.NO_COLOR) depth = 1;
  const unicode = !plain && unicodeLikely(env, platform);
  // OSC 8 hyperlinks: shown as text with the URL beside it everywhere, and
  // clickable where the terminal is known to support them.
  const links = !plain && Boolean(env.WT_SESSION || env.TERM_PROGRAM === 'iTerm.app' || env.TERM_PROGRAM === 'vscode' || env.TERM_PROGRAM === 'WezTerm' || env.KITTY_WINDOW_ID || env.VTE_VERSION);
  const motion = tty && depth > 1 && unicode && !plain && !calm && env.TERM !== 'dumb';
  // OSC 52, which puts text on the clipboard: only in terminals that write
  // it there by default (kitty, WezTerm, Ghostty, Alacritty, Windows
  // Terminal), and not through tmux or screen, which keep it to themselves
  // unless set up to pass it on. Terminal.app ignores it, and iTerm2 asks
  // for a setting first, so neither is listed.
  const clipboard = tty && !plain && env.TERM !== 'dumb' && !env.TMUX && !env.STY
    && Boolean(env.KITTY_WINDOW_ID || env.TERM_PROGRAM === 'WezTerm' || env.TERM_PROGRAM === 'ghostty' || env.ALACRITTY_WINDOW_ID || env.WT_SESSION);
  // Over SSH or in a Codespace: a frame crosses the network, so the detailed
  // Pip does not breathe there.
  const codespace = env.CODESPACES === 'true';
  const remote = Boolean(env.SSH_CONNECTION || env.SSH_TTY || codespace);
  return { tty, depth, unicode, links, motion, calm, clipboard, remote, win32: platform === 'win32', codespace };
}

// The bytes that ask the terminal to put `text` on the clipboard.
export const osc52 = (text) => `\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`;
