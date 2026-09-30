const encoder = new TextEncoder();

export const TOKEN_KEY_VERSION = 1;

function toBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * The encryption key secret is a high-entropy random string. Deriving a
 * 32-byte AES key from it with SHA-256 keeps the key material server-only and
 * independent of the secret's text encoding.
 */
async function aesKey(): Promise<CryptoKey> {
  const raw = process.env["ELEARN_TOKEN_ENCRYPTION_KEY_V1"];
  if (!raw || raw.length < 32) throw new Error("encryption_key_configuration");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token: string, userId: string, baseUrl: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = encoder.encode(`${userId}|${baseUrl}`);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
    await aesKey(),
    encoder.encode(token),
  );
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv), keyVersion: TOKEN_KEY_VERSION };
}

export async function decryptToken(
  ciphertext: string,
  iv: string,
  userId: string,
  baseUrl: string,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(iv),
      additionalData: encoder.encode(`${userId}|${baseUrl}`),
      tagLength: 128,
    },
    await aesKey(),
    fromBase64(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
