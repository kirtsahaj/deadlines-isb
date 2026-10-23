import { decryptToken } from "./crypto.server";
import { MoodleClient } from "./moodle.server";
import { elearnBaseUrl } from "./config.server";

export type CoursepackItem = { id: string; name: string; kind: "file" | "link"; size: number | null; url: string };

/** Only course packs and readings — never forums, Zoom, attendance or dropboxes. */
const MATERIAL = /course\s*-?\s*pack|coursepack|reading|pre-?read|\bcases?\b|\bhbp\b|\bhbs\b|ivey/i;
const EXCLUDE = /zoom|teams|attendance|submission|submit|dropbox|forum|announcement|quiz|feedback|recording/i;
const MODS = new Set(["resource", "folder", "url"]);

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmacKey() {
  const raw = process.env["ELEARN_TOKEN_ENCRYPTION_KEY_V1"];
  if (!raw || raw.length < 32) throw new Error("encryption_key_configuration");
  const d = await crypto.subtle.digest("SHA-256", enc.encode(`coursepack-ticket|${raw}`));
  return crypto.subtle.importKey("raw", d, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Short-lived signed ticket so the browser can download without ever seeing the eLearn key. */
export async function signTicket(userId: string, fileUrl: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ u: userId, f: fileUrl, e: Date.now() + 10 * 60_000 })));
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body)));
  return `${body}.${sig}`;
}

export async function verifyTicket(ticket: string): Promise<{ u: string; f: string } | null> {
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64(body))) as { u: string; f: string; e: number };
    return p.e > Date.now() ? p : null;
  } catch {
    return null;
  }
}

export async function userToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("elearn_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return decryptToken(data.token_ciphertext, data.token_iv, userId, data.base_url);
}

export function isElearnFile(url: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(elearnBaseUrl());
    return u.origin === base.origin && u.pathname.includes("/pluginfile.php/") && !u.search.includes("token");
  } catch {
    return false;
  }
}

type Mod = { modname?: string; name?: string; url?: string; contents?: { type?: string; filename?: string; fileurl?: string; filesize?: number }[] };

export async function listCoursepacks(userId: string, courseId: number): Promise<CoursepackItem[] | null> {
  const token = await userToken(userId);
  if (!token) return null;
  const sections = (await new MoodleClient(token, Date.now() + 25_000).call("core_course_get_contents", { courseid: courseId })) as { modules?: Mod[] }[];
  const items: CoursepackItem[] = [];
  for (const s of Array.isArray(sections) ? sections : []) {
    for (const m of s.modules ?? []) {
      const name = m.name ?? "";
      if (!MODS.has(m.modname ?? "") || EXCLUDE.test(name)) continue;
      for (const c of m.contents ?? []) {
        const label = m.modname === "folder" ? c.filename ?? name : name;
        if (!MATERIAL.test(`${name} ${c.filename ?? ""}`)) continue;
        if (c.type === "file" && c.fileurl && isElearnFile(c.fileurl)) {
          items.push({ id: c.fileurl, name: label, kind: "file", size: c.filesize ?? null, url: await signTicket(userId, c.fileurl) });
        } else if (c.type === "url" && c.fileurl && /^https:\/\//.test(c.fileurl)) {
          items.push({ id: c.fileurl, name, kind: "link", size: null, url: c.fileurl });
        }
      }
    }
  }
  return [...new Map(items.map((i) => [i.id, i])).values()];
}
