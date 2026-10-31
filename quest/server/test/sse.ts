// A reader for GET /api/events through app.request(): it pumps the body in
// the background and parses each frame's event, id, retry and JSON data.
// Nothing here binds a port; close() cancels the body, as a tab leaving does.
import type { Hono } from "hono";
import { HOST } from "./action-kit.ts";

export interface Frame {
  event: string;
  id?: string;
  retry?: number;
  data: unknown;
}

export interface Reader {
  response: Response;
  /** The next frame, waiting for it. */
  next(): Promise<Frame>;
  /** The next `n` frames. */
  frames(n: number): Promise<Frame[]>;
  /** The frames received and not yet taken, without waiting. */
  queued(): Frame[];
  /** Settles when the server ends the stream. */
  ended: Promise<undefined>;
  close(): Promise<void>;
}

export function parseFrame(text: string): Frame {
  const frame: Frame = { event: "message", data: undefined };
  const data: string[] = [];
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    const name = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^ /, "");
    if (name === "event") frame.event = value;
    else if (name === "id") frame.id = value;
    else if (name === "retry") frame.retry = Number(value);
    else if (name === "data") data.push(value);
  }
  frame.data = JSON.parse(data.join("\n"));
  return frame;
}

/** Same-origin GET headers, with `headers` over them. */
export function streamHeaders(
  headers: Record<string, string | undefined> = {},
): Record<string, string> {
  const all: Record<string, string | undefined> = {
    Host: HOST,
    "Sec-Fetch-Site": "same-origin",
    ...headers,
  };
  return Object.fromEntries(
    Object.entries(all).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export async function openStream(
  app: Hono,
  {
    headers = {},
    query = "",
  }: { headers?: Record<string, string | undefined>; query?: string } = {},
): Promise<Reader> {
  const response = await app.request(`/api/events${query}`, {
    headers: streamHeaders(headers),
  });
  const got: Frame[] = [];
  const waiting: ((frame: Frame) => void)[] = [];
  const ended = Promise.withResolvers<undefined>();
  // A refusal's body is left for the test to read.
  const reader = response.headers
    .get("Content-Type")
    ?.startsWith("text/event-stream")
    ? response.body?.getReader()
    : undefined;
  const pump = async () => {
    if (!reader) return;
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const read: { done: boolean; value?: Uint8Array } = await reader
        .read()
        .catch(() => ({ done: true }));
      if (read.done) break;
      text += decoder.decode(read.value, { stream: true });
      let at: number;
      while ((at = text.indexOf("\n\n")) >= 0) {
        const frame = parseFrame(text.slice(0, at));
        text = text.slice(at + 2);
        const waiter = waiting.shift();
        if (waiter) waiter(frame);
        else got.push(frame);
      }
    }
  };
  void pump().finally(() => {
    ended.resolve(undefined);
  });
  const next = () => {
    const frame = got.shift();
    if (frame) return Promise.resolve(frame);
    return new Promise<Frame>((resolve) => waiting.push(resolve));
  };
  return {
    response,
    next,
    frames: async (n) => {
      const out: Frame[] = [];
      for (let i = 0; i < n; i++) out.push(await next());
      return out;
    },
    queued: () => got.splice(0),
    ended: ended.promise,
    close: async () => {
      await reader?.cancel().catch(() => undefined);
    },
  };
}
