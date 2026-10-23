export const MAX_JD_BYTES = 15 * 1024 * 1024;

export type SniffedDoc = { ext: "pdf" | "doc" | "docx"; mime: string };

function indexOfBytes(hay: Uint8Array, needle: number[], limit = hay.length): number {
  outer: for (let i = 0; i + needle.length <= Math.min(hay.length, limit); i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/**
 * Accepts only real PDF / DOC / DOCX by file signature (the declared MIME type is ignored because
 * CAS often sends PDFs as application/octet-stream). Everything else is rejected.
 */
export function sniffDocument(bytes: Uint8Array, filename: string | null): SniffedDoc | null {
  if (!bytes.length || bytes.length > MAX_JD_BYTES) return null;
  const name = (filename ?? "").toLowerCase();
  if (indexOfBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d], 1024) >= 0) return { ext: "pdf", mime: "application/pdf" };
  const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (ole.every((b, i) => bytes[i] === b) && name.endsWith(".doc")) return { ext: "doc", mime: "application/msword" };
  const zip = [0x50, 0x4b, 0x03, 0x04];
  if (zip.every((b, i) => bytes[i] === b) && name.endsWith(".docx") && indexOfBytes(bytes, [...new TextEncoder().encode("word/")]) >= 0) {
    return { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  return null;
}

export function safeFilename(name: string | null, ext: string): string {
  const base = (name ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[^\w\s.-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${base || "Job description"}.${ext}`;
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
