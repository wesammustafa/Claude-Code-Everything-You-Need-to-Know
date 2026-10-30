// Every route, as [method, path]: each must pass the trust checks. Ticket
// 218 appends ["GET", "/api/events"].
export const ROUTES: readonly (readonly [string, string])[] = [
  ["GET", "/api/health"],
  ["GET", "/"],
  ["HEAD", "/"],
  ["GET", "/assets/app-abc123.js"],
  ["GET", "/api/nothing"],
  ["GET", "/missing"],
  ["POST", "/api/actions"],
];
