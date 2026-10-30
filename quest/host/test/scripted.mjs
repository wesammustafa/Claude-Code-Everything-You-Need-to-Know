// Helpers for the host's tests on fake adapters (not a test file): a host
// over the Beginner fixture course in a fake practice copy, and a scripted
// engine, the real one wrapped so a test can add effects to an input of a
// real type and see each input it reduced, in order, with how deeply
// reduces nested.
import { initialState, reduce } from "../src/engine.mjs";
import { createHost } from "../src/host.mjs";
import { fakeAdapters, fakeClock } from "../src/fake.mjs";
import { b1Only, FACTS } from "../../engine/test/drive.mjs";

export const ROOT = FACTS.root;
export const PRACTICE = `${ROOT}/.practice`;
export const VERSION = ".practice/version.txt";
// Saved at b-1's W3, the check beat that waits for .practice/version.txt.
export const AT_W3 = {
  format: 1,
  welcomed: true,
  lessons: { "b-1": { step: "W3", beat: 0, done: ["W1", "W2"] } },
};
// b-1's W3 item, as the check child answers it.
export const w3 = (pass, rest = {}) => ({
  items: [
    {
      index: 0,
      text: "`.practice/version.txt` holds the output of `claude --version`",
      pass,
      hint: pass ? "" : "No `.practice/version.txt` yet.",
      ...rest,
    },
  ],
});

// The real engine, wrapped: `effects[type]` (a list, or a function of the
// state after the input and the input) is added to what an input of that
// type asks for. `log` holds each input reduced, its depth (1: not nested)
// and the input.
export function scripted({ effects = {} } = {}) {
  const log = [];
  let depth = 0;
  const engine = {
    initialState,
    reduce(state, input) {
      depth += 1;
      try {
        log.push({ type: input.type, depth, input });
        const r = reduce(state, input);
        const more = effects[input.type];
        const extra =
          typeof more === "function" ? more(r.state, input) : (more ?? []);
        return { ...r, effects: [...r.effects, ...extra] };
      } finally {
        depth -= 1;
      }
    },
  };
  return { engine, log };
}

// A host on fake adapters over the Beginner fixture course (b-1 alone has
// content), in a fake practice copy that holds `.practice/`.
export function fakeHost({
  saved = null,
  tree = { [PRACTICE]: null },
  clock = fakeClock(),
  engine = undefined,
  course = b1Only,
  facts = {},
  ahead = null,
  env = {},
  platform = "linux",
  ...fakes
} = {}) {
  const adapters = fakeAdapters({ root: ROOT, clock, tree, saved, ...fakes });
  const host = createHost({
    root: ROOT,
    course,
    saved,
    env: { HOME: "/home/sam", ...env },
    platform,
    adapters,
    facts,
    engine,
    ahead,
  });
  const heard = [];
  host.subscribe((h) => heard.push(h));
  return { host, adapters, clock, heard };
}

// A few turns of the event loop, for microtasks and promise answers.
export const turn = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
};

// The inputs the host reduced, by type, from its listener's record.
export const typesOf = (heard) => heard.map((h) => h.input.type);
