export type ParsedElearnConnection = string;

/**
 * Decode the Moodle mobile launch redirect entirely in the student's browser.
 * Deliberately returns only the REST token and discards the private autologin token.
 */
export function parseElearnConnectionCode(input: string): ParsedElearnConnection {
  const text = decodeURIComponent(input.trim().replace(/^['"]|['"]$/g, ""));
  const match =
    text.match(/moodlemobile:\/\/token=([A-Za-z0-9+/_=-]+)/i) ??
    text.match(/moodlemobile:\/\/[^\s'"]*?[?&]token=([A-Za-z0-9+/_=-]+)/i) ??
    text.match(/(?:^|[?&\s])token=([A-Za-z0-9+/_=-]+)/i);
  if (!match) throw new Error("invalid_connection_code");

  let encoded = match[1].replace(/-/g, "+").replace(/_/g, "/");
  encoded += "=".repeat((4 - (encoded.length % 4)) % 4);
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    throw new Error("invalid_connection_code");
  }
  const parts = decoded.split(":::");
  const token = parts[1] ?? "";
  if (!/^[A-Za-z0-9]{16,128}$/.test(token)) throw new Error("invalid_connection_code");
  return { token };
}
