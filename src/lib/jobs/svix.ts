/** Resend signs webhooks with Svix: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`. */
export const SVIX_TOLERANCE_SECONDS = 5 * 60;

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySvix(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: Uint8Array,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > SVIX_TOLERANCE_SECONDS) return false;
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = b64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prefix = new TextEncoder().encode(`${id}.${timestamp}.`);
  const signed = new Uint8Array(prefix.length + rawBody.length);
  signed.set(prefix);
  signed.set(rawBody, prefix.length);
  const expected = bytesToB64(new Uint8Array(await crypto.subtle.sign("HMAC", key, signed)));
  return signature.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    return version === "v1" && !!sig && safeEqual(sig, expected);
  });
}

/** Test helper: produce a valid signature header. */
export async function signSvix(secret: string, id: string, timestamp: string, rawBody: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", b64ToBytes(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prefix = new TextEncoder().encode(`${id}.${timestamp}.`);
  const signed = new Uint8Array(prefix.length + rawBody.length);
  signed.set(prefix);
  signed.set(rawBody, prefix.length);
  return `v1,${bytesToB64(new Uint8Array(await crypto.subtle.sign("HMAC", key, signed)))}`;
}
