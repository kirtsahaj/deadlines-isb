/**
 * Minimal, bounded MIME reader for forwarded CAS mail. Pure and runtime-neutral (Workers + tests).
 * Never fetches anything: remote images, tracking pixels and links in mail are only ever text.
 */

export type MimePart = {
  headers: Record<string, string>;
  contentType: string;
  params: Record<string, string>;
  disposition: string;
  filename: string | null;
  contentId: string | null;
  body: Uint8Array;
  children: MimePart[];
  /** Parsed attached message for message/rfc822 parts. */
  message: MimePart | null;
};

export const MAX_DEPTH = 5;
const MAX_PARTS = 300;

const latin1 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
};
const fromLatin1 = (s: string) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

function decodeCharset(bytes: Uint8Array, charset: string | undefined): string {
  const cs = (charset ?? "utf-8").toLowerCase().replace(/^"|"$/g, "");
  try {
    return new TextDecoder(cs === "us-ascii" ? "utf-8" : cs, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function decodeBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  try {
    return fromLatin1(atob(padded));
  } catch {
    return new Uint8Array();
  }
}

function decodeQP(s: string): Uint8Array {
  const text = s.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(text.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(out);
}

/** RFC 2047 encoded words, e.g. =?UTF-8?B?...?= */
export function decodeWords(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_m, cs: string, enc: string, data: string) => {
      const bytes = enc.toUpperCase() === "B" ? decodeBase64(data) : decodeQP(data.replace(/_/g, " "));
      return decodeCharset(bytes, cs);
    });
}

export function parseHeaders(block: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (!(key in headers)) headers[key] = line.slice(idx + 1).trim();
  }
  return headers;
}

export function parseParams(value: string): { value: string; params: Record<string, string> } {
  const [head, ...rest] = value.split(";");
  const params: Record<string, string> = {};
  for (const piece of rest) {
    const idx = piece.indexOf("=");
    if (idx <= 0) continue;
    let key = piece.slice(0, idx).trim().toLowerCase();
    let val = piece.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (key.endsWith("*")) {
      key = key.replace(/\*\d*\*?$/, "");
      const m = /^([^']*)'[^']*'(.*)$/.exec(val);
      try {
        val = m ? decodeURIComponent(m[2] ?? "") : decodeURIComponent(val);
      } catch {
        /* keep raw */
      }
      params[key] = (params[key] && /\*\d+\*?$/.test(piece.slice(0, idx).trim()) ? params[key] : "") + val;
    } else if (!(key in params)) params[key] = decodeWords(val);
  }
  return { value: (head ?? "").trim().toLowerCase(), params };
}

function splitHead(raw: string): [string, string] {
  const m = /\r?\n\r?\n/.exec(raw);
  if (!m) return [raw, ""];
  return [raw.slice(0, m.index), raw.slice(m.index + m[0].length)];
}

function parseBinary(raw: string, depth: number, budget: { parts: number }): MimePart {
  budget.parts++;
  const [head, bodyRaw] = splitHead(raw);
  const headers = parseHeaders(head);
  const ct = parseParams(headers["content-type"] ?? "text/plain");
  const disp = parseParams(headers["content-disposition"] ?? "");
  const cte = (headers["content-transfer-encoding"] ?? "").toLowerCase().trim();
  const filename = disp.params["filename"] ?? ct.params["name"] ?? null;
  const part: MimePart = {
    headers,
    contentType: ct.value || "text/plain",
    params: ct.params,
    disposition: disp.value,
    filename: filename ? decodeWords(filename) : null,
    contentId: headers["content-id"]?.replace(/[<>]/g, "") ?? null,
    body: new Uint8Array(),
    children: [],
    message: null,
  };

  if (part.contentType.startsWith("multipart/") && ct.params["boundary"]) {
    if (depth >= MAX_DEPTH) return part;
    const delim = `--${ct.params["boundary"]}`;
    const pieces = bodyRaw.split(delim);
    for (const piece of pieces.slice(1)) {
      if (piece.startsWith("--") || budget.parts >= MAX_PARTS) break;
      part.children.push(parseBinary(piece.replace(/^[ \t]*\r?\n/, ""), depth + 1, budget));
    }
    return part;
  }

  part.body = cte === "base64" ? decodeBase64(bodyRaw) : cte === "quoted-printable" ? decodeQP(bodyRaw) : fromLatin1(bodyRaw);
  if (part.contentType === "message/rfc822" && depth < MAX_DEPTH && budget.parts < MAX_PARTS) {
    part.message = parseBinary(latin1(part.body), depth + 1, budget);
  }
  return part;
}

export function parseMime(bytes: Uint8Array): MimePart {
  return parseBinary(latin1(bytes), 0, { parts: 0 });
}

export function partText(part: MimePart): string {
  return decodeCharset(part.body, part.params["charset"]);
}

export function isAttachment(part: MimePart): boolean {
  return part.disposition === "attachment" || (!!part.filename && part.disposition !== "inline");
}

/** Strips HTML to text. Tags, images, scripts and styles are dropped; nothing is loaded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n[ \t]*\n+/g, "\n");
}

/** Readable body text for a message part (own text only; attached messages are not merged in). */
export function bodyText(msg: MimePart): string {
  let plain: string | null = null;
  let html: string | null = null;
  const walk = (p: MimePart) => {
    if (p.contentType.startsWith("multipart/")) return p.children.forEach(walk);
    if (isAttachment(p) || p.contentType === "message/rfc822") return;
    if (p.contentType === "text/plain" && plain === null) plain = partText(p);
    if (p.contentType === "text/html" && html === null) html = partText(p);
  };
  walk(msg);
  const p = plain as string | null;
  const h = html as string | null;
  if (p && p.trim()) return p;
  return h ? htmlToText(h) : "";
}

/** Raw HTML body of a message part (own body only), used solely to read structured tables; never rendered or fetched. */
export function bodyHtml(msg: MimePart): string {
  let html: string | null = null;
  const walk = (p: MimePart) => {
    if (html !== null) return;
    if (p.contentType.startsWith("multipart/")) return p.children.forEach(walk);
    if (isAttachment(p) || p.contentType === "message/rfc822") return;
    if (p.contentType === "text/html") html = partText(p);
  };
  walk(msg);
  return (html as string | null) ?? "";
}

/** File attachments of a message (excluding nested messages, inline images and alternative bodies). */
export function fileAttachments(msg: MimePart): MimePart[] {
  const out: MimePart[] = [];
  const walk = (p: MimePart) => {
    if (p.contentType.startsWith("multipart/")) return p.children.forEach(walk);
    if (p.contentType === "message/rfc822") return;
    if (!isAttachment(p) || p.disposition === "inline" || p.contentType.startsWith("image/")) return;
    out.push(p);
  };
  walk(msg);
  return out;
}

export function bareAddress(value: string | undefined | null): string {
  const v = decodeWords(value ?? "");
  const m = /<([^<>@\s]+@[^<>\s]+)>/.exec(v) ?? /([^\s"<>,;:]+@[^\s"<>,;:]+)/.exec(v);
  return (m?.[1] ?? "").toLowerCase().replace(/[.]+$/, "");
}
