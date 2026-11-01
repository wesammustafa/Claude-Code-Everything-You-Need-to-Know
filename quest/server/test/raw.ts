// Raw HTTP over a socket, for the requests fetch() would correct or refuse
// to send: a duplicated Host, an absolute-form line, `..` kept in a path.
// Servers listen on port 0, never on 4747 to 4756.
import type { Server } from "node:http";
import { connect } from "node:net";
import { listen } from "../src/listen.ts";

export interface Reply {
  status: number;
  headers: Map<string, string>;
  body: string;
}

/** Sends `text` as it is and reads to the end, or null when the server closes with no reply. */
export function raw(
  port: number,
  text: string | Buffer,
): Promise<Reply | null> {
  return new Promise((resolve, reject) => {
    let got = "";
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(text);
    });
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => (got += chunk));
    socket.on("end", () => {
      resolve(parse(got));
    });
    socket.on("close", () => {
      resolve(parse(got));
    });
    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNRESET") resolve(parse(got));
      else reject(error);
    });
  });
}

/** Sends `text` and reads the reply's head alone, then drops the socket: for a stream. */
export function rawHead(port: number, text: string): Promise<Reply | null> {
  return new Promise((resolve, reject) => {
    let got = "";
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(text);
    });
    const done = () => {
      socket.destroy();
      resolve(parse(got));
    };
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      got += chunk;
      if (got.includes("\r\n\r\n")) done();
    });
    socket.on("end", done);
    socket.on("close", done);
    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNRESET") done();
      else reject(error);
    });
  });
}

function parse(text: string): Reply | null {
  if (!text) return null;
  const at = text.indexOf("\r\n\r\n");
  const [line = "", ...lines] = text.slice(0, at).split("\r\n");
  const headers = new Map(
    lines.map((header) => {
      const colon = header.indexOf(":");
      return [
        header.slice(0, colon).toLowerCase(),
        header.slice(colon + 1).trim(),
      ];
    }),
  );
  return {
    status: Number(line.split(" ")[1]),
    headers,
    body: text.slice(at + 4),
  };
}

/** A request with `Connection: close`, so the reply ends with the socket. */
export function request(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body = "",
): string {
  const lines = [`${method} ${path} HTTP/1.1`];
  for (const [name, value] of Object.entries(headers))
    lines.push(`${name}: ${value}`);
  if (body && !("Content-Length" in headers))
    lines.push(`Content-Length: ${String(Buffer.byteLength(body))}`);
  lines.push("Connection: close");
  return `${lines.join("\r\n")}\r\n\r\n${body}`;
}

/** `fetch` served on a free port from 0, with `serverOptions` over the defaults. */
export async function serve(
  fetch: (request: Request) => Response | Promise<Response>,
  serverOptions: Parameters<typeof listen>[0]["serverOptions"] = {},
): Promise<{ server: Server; port: number }> {
  const got = await listen({ fetch, base: 0, serverOptions });
  if (!got) throw new Error("no port");
  return got;
}
