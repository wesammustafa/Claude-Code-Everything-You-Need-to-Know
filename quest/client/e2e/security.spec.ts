// The browser security suite (222): the built app in a fresh Practice copy,
// attacked from a page on another local port and through a rebound host
// name. Every attempt must be refused or unreadable and change no revision.
//
// Out of scope here, with the reason:
// - c, j: Model A sets no cookies, so there is no credential to ride along.
// - k: tests Chrome itself; its server side is the form case (h) below.
// - l: covered by quest/server's events.test.ts (the Sec-Fetch-Site refusal).
// - m, n, o: a page cannot produce these requests; trust.test.ts covers them.
// - p, q, r: not security behavior, or not reproducible in a test browser.
// - d, s: covered by the Vitest Host regex in trust.test.ts.
// - The Origin and Sec-Fetch-Site guards on /api/actions: no page reaches
//   them. Chrome stops a cross-origin JSON POST at its preflight, and every
//   other POST it can send fails the content-type guard first. Only
//   trust.test.ts can fail if either is removed.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, expect, test, type Browser } from "@playwright/test";
import { practiceCopy, type PracticeCopy } from "./practice-copy.ts";

// A codespace's variables would make the app trust a forwarded host.
delete process.env.CODESPACE_NAME;
delete process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

test.describe.configure({ mode: "serial" });

const ATTACK = "<!doctype html><title>Another site</title><p>Attacker</p>";

let copy: PracticeCopy;
let attacker: Server;
let attackerPort = 0;
/** Resolves 127.0.0.1 and localhost only, so both attacker origins load. */
let browser: Browser;

test.beforeAll(async () => {
  test.setTimeout(60_000);
  copy = practiceCopy();
  await copy.start();
  // A plain page with no CSP: the test scripts it from its own origin.
  attacker = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(ATTACK);
  });
  await new Promise<void>((done) => attacker.listen(0, "127.0.0.1", done));
  attackerPort = (attacker.address() as AddressInfo).port;
  browser = await chromium.launch({
    args: [
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
    ],
  });
});

test.afterAll(async () => {
  await browser.close();
  await new Promise((done) => attacker.close(done));
  await copy.dispose();
});

interface Mark {
  instance: string;
  revision: number;
}

/** The instance and revision of the stream's first snapshot frame. */
async function revision(): Promise<Mark> {
  const abort = new AbortController();
  const response = await fetch(`${copy.url}/api/events`, {
    signal: abort.signal,
  });
  if (response.body === null) throw new Error("No stream");
  const decoder = new TextDecoder();
  let text = "";
  try {
    for await (const chunk of response.body) {
      text += decoder.decode(chunk, { stream: true });
      const frame = /event: snapshot\ndata: (.*)\n/.exec(text);
      if (frame) {
        const { instance, revision } = JSON.parse(frame[1] as string) as Mark;
        return { instance, revision };
      }
    }
  } finally {
    abort.abort();
  }
  throw new Error(`No snapshot frame:\n${text}`);
}

/** A valid request: only the trust rules can refuse it. */
const payload = ({ instance, revision }: Mark) =>
  JSON.stringify({ action: { type: "welcome.finish" }, instance, revision });

async function unchanged(attack: (mark: Mark) => Promise<void>) {
  const before = await revision();
  // Each attack awaits its refusal (a response, a TypeError, a closed
  // stream), so the probe needs no settle time.
  await attack(before);
  expect(await revision()).toEqual(before);
}

for (const [label, hostname] of [
  ["same-site", "127.0.0.1"],
  ["cross-site", "localhost"],
] as const) {
  test.describe(`a page on another port (${label})`, () => {
    const origin = () => `http://${hostname}:${String(attackerPort)}`;

    async function attackerPage() {
      const page = await browser.newPage();
      await page.goto(origin());
      return page;
    }

    test("a JSON fetch POST is refused before it is sent", async () => {
      const page = await attackerPage();
      await unchanged(async (mark) => {
        const failed = await page.evaluate(
          async ([url, body]) => {
            try {
              await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
              });
              return "read";
            } catch (error) {
              return error instanceof TypeError ? "TypeError" : String(error);
            }
          },
          [`${copy.url}/api/actions`, payload(mark)] as const,
        );
        expect(failed).toBe("TypeError");
      });
      await page.close();
    });

    // Not even opaque: the 403's Cross-Origin-Resource-Policy: same-origin
    // makes Chrome fail the no-cors fetch outright.
    test("a no-cors text/plain POST is blocked", async () => {
      const page = await attackerPage();
      await unchanged(async (mark) => {
        const seen = await page.evaluate(
          async ([url, body]) => {
            try {
              const response = await fetch(url, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body,
              });
              return `${response.type} ${String(response.status)}`;
            } catch (error) {
              return error instanceof TypeError ? "TypeError" : String(error);
            }
          },
          [`${copy.url}/api/actions`, payload(mark)] as const,
        );
        expect(seen).toBe("TypeError");
      });
      await page.close();
    });

    // The stream's 403 rests on 218 D12, which the owner has not ratified:
    // this asserts only what holds either way, an unreadable stream. CORS
    // fails it with or without the 403, so events.test.ts guards that line.
    test("an EventSource gets no message", async () => {
      const page = await attackerPage();
      await unchanged(async () => {
        const seen = await page.evaluate(async (url) => {
          const source = new EventSource(url);
          let messages = 0;
          source.addEventListener("snapshot", () => (messages += 1));
          source.onmessage = () => (messages += 1);
          const state = await new Promise<number>((done) => {
            source.onerror = () => {
              done(source.readyState);
            };
          });
          source.close();
          return { state, messages };
        }, `${copy.url}/api/events`);
        expect(seen).toEqual({ state: 2, messages: 0 });
      });
      await page.close();
    });

    test("a form post lands on a 403 or an unreadable frame", async () => {
      const page = await attackerPage();
      await unchanged(async (mark) => {
        // An urlencoded form into an iframe: its document stays unreadable.
        const readable = await page.evaluate(async (url) => {
          const frame = document.createElement("iframe");
          frame.name = "sink";
          document.body.append(frame);
          const loaded = new Promise((done) => (frame.onload = done));
          const form = document.createElement("form");
          form.method = "POST";
          form.action = url;
          form.target = "sink";
          const field = document.createElement("input");
          field.name = "action";
          field.value = "welcome.finish";
          form.append(field);
          document.body.append(form);
          form.submit();
          await loaded;
          return frame.contentDocument !== null;
        }, `${copy.url}/api/actions`);
        expect(readable).toBe(false);

        // A top-level text/plain form whose body parses as the JSON payload:
        // the name opens a duplicate "instance" key the value overrides.
        // The content-type guard refuses it, before the Origin guard.
        const json = payload(mark);
        const name = '{"instance":"';
        const value = `",${json.slice(1)}`;
        expect(JSON.parse(`${name}=${value}`)).toEqual(JSON.parse(json));
        const landed = page.waitForResponse(`${copy.url}/api/actions`);
        await page.evaluate(
          ([url, name, value]) => {
            const form = document.createElement("form");
            form.method = "POST";
            form.enctype = "text/plain";
            form.action = url;
            const field = document.createElement("input");
            field.name = name;
            field.value = value;
            form.append(field);
            document.body.append(form);
            form.submit();
          },
          [`${copy.url}/api/actions`, name, value] as const,
        );
        expect((await landed).status()).toBe(403);
      });
      await page.close();
    });
  });
}

test("a rebound host name is refused on every route", async () => {
  const rebind = await chromium.launch({
    args: [
      "--host-resolver-rules=MAP quest-rebind.test 127.0.0.1, MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
    ],
  });
  try {
    const page = await rebind.newPage();
    const base = `http://quest-rebind.test:${String(copy.port)}`;
    await unchanged(async (mark) => {
      for (const path of ["/", "/api/health", "/favicon.svg"]) {
        const response = await page.goto(`${base}${path}`);
        expect(response?.status(), path).toBe(403);
      }
      // From the rebound page, its "same-origin" requests.
      const seen = await page.evaluate(
        async ([body]) => {
          const posted = await fetch("/api/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          const source = new EventSource("/api/events");
          const state = await new Promise<number>((done) => {
            source.onerror = () => {
              done(source.readyState);
            };
          });
          source.close();
          return { status: posted.status, state };
        },
        [payload(mark)] as const,
      );
      expect(seen).toEqual({ status: 403, state: 2 });
    });
  } finally {
    await rebind.close();
  }
});

test("the bundle carries the CSP and it blocks an inline script", async ({
  page,
}) => {
  const response = await page.goto(copy.url);
  const policy = response?.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(policy).toContain("form-action 'none'");
  const seen = await page.evaluate(async () => {
    const violated = new Promise<string>((done) => {
      document.addEventListener("securitypolicyviolation", (event) => {
        done(event.effectiveDirective);
      });
    });
    const script = document.createElement("script");
    script.textContent = "window.questInlineRan = true;";
    document.head.append(script);
    const directive = await violated;
    return {
      directive,
      ran: (window as { questInlineRan?: boolean }).questInlineRan === true,
    };
  });
  expect(seen).toEqual({ directive: "script-src-elem", ran: false });
});

// The controls, last: they prove the payload and the probe would see a
// change, and the POST moves the Learner past the welcome.
test("the app itself connects, and its own POST raises the revision", async ({
  page,
}) => {
  const health = await fetch(`${copy.url}/api/health`);
  expect(health.status).toBe(200);
  await page.goto(copy.url);
  await expect(
    page.getByRole("button", { name: "Start the first lesson" }),
  ).toBeVisible();
  await expect(page.locator("[data-connection=waiting]")).toHaveCount(0);
  const before = await revision();
  const status = await page.evaluate(
    async ([body]) =>
      (
        await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        })
      ).status,
    [payload(before)] as const,
  );
  expect(status).toBe(200);
  await expect
    .poll(async () => (await revision()).revision)
    .toBeGreaterThan(before.revision);
});
