// One JSON line per request. Never logs tokens, request bodies, emails or IP addresses.
export function defaultLog(line: Record<string, unknown>) {
  console.log(JSON.stringify(line));
}
