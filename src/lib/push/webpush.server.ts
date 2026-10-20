import { VAPID_PUBLIC_KEY, b64urlToBytes, bytesToB64url } from "./vapid";

/** Workers-safe Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) using WebCrypto only. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

const enc = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

async function vapidJwt(endpoint: string): Promise<string> {
  const d = process.env["VAPID_PRIVATE_KEY_D"];
  if (!d) throw new Error("push_not_configured");
  const pub = b64urlToBytes(VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d, x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)) },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:deadlines@isb.edu",
  })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${bytesToB64url(new Uint8Array(sig))}`;
}

async function encrypt(target: PushTarget, payload: string) {
  const uaPublic = b64urlToBytes(target.p256dh);
  const authSecret = b64urlToBytes(target.auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const prkKey = await hmac(authSecret, shared);
  const ikm = (await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** Returns "gone" when the browser subscription expired and should be deleted. */
export async function sendPush(target: PushTarget, message: object): Promise<"sent" | "gone" | "failed"> {
  try {
    const body = await encrypt(target, JSON.stringify(message));
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${await vapidJwt(target.endpoint)}, k=${VAPID_PUBLIC_KEY}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "10800",
        Urgency: "high",
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
