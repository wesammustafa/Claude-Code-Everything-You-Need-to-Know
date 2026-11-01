// Every route, as [method, path]: each must pass the trust checks. The
// events route answers with a stream that never ends: a test reads its head
// and cancels or drops it.
export const ROUTES: readonly (readonly [string, string])[] = [
  ["GET", "/api/health"],
  ["GET", "/"],
  ["HEAD", "/"],
  ["GET", "/assets/app-abc123.js"],
  ["GET", "/api/nothing"],
  ["GET", "/missing"],
  ["POST", "/api/actions"],
  ["GET", "/api/events"],
];
