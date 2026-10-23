import { bareAddress, bodyHtml, bodyText, decodeWords, htmlToText, fileAttachments, MAX_DEPTH, type MimePart } from "./mime";

export type DateParts = { date?: string; time?: string };
export type ParsedJobEvent = {
  kind: "broadcast" | "modified";
  company: string;
  role: string | null;
  deadline?: DateParts;
  shortlist?: { date: string };
  rename?: { from: string; to: string };
};

export type OriginalMessage = {
  from: string;
  subject: string;
  sentAt: string | null;
  messageId: string | null;
  text: string;
  /** Original HTML when available; read only for the CAS change table. */
  html?: string;
  attachments: MimePart[];
  via: "attachment" | "inline" | "direct";
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

type M = [string, string, string, string, string] & { index: number };
const ex = (re: RegExp, s: string | undefined): M | null => re.exec(s ?? "") as unknown as M | null;

const pad = (n: number) => String(n).padStart(2, "0");
function validDate(y: number, m: number, d: number): string | undefined {
  if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : undefined;
}

/** Parses explicit date and/or time parts; anything not stated stays undefined (never invented). */
export function parseDateParts(value: string): DateParts {
  const out: DateParts = {};
  let rest = value;
  const tryMatch = (re: RegExp, fn: (m: M) => string | undefined) => {
    if (out.date) return;
    const m = ex(re, rest);
    if (!m) return;
    const date = fn(m);
    if (date) {
      out.date = date;
      rest = rest.replace(m[0], " ");
    }
  };
  tryMatch(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, (m) => validDate(+m[1], +m[2], +m[3]));
  tryMatch(/\b(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})[\s\-/.,]+(\d{4})\b/, (m) => {
    const mon = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith("sept") ? 4 : 3)];
    return mon ? validDate(+m[3], mon, +m[1]) : undefined;
  });
  tryMatch(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/, (m) => {
    const mon = MONTHS[m[1].toLowerCase().slice(0, 3)];
    return mon ? validDate(+m[3], mon, +m[2]) : undefined;
  });
  tryMatch(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/, (m) => validDate(+m[3], +m[2], +m[1]));

  const ampm = ex(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i, rest);
  if (ampm) {
    let h = +ampm[1];
    const min = ampm[2] ? +ampm[2] : 0;
    const pm = ampm[3].toLowerCase().startsWith("p");
    if (h >= 1 && h <= 12 && min < 60) {
      if (h === 12) h = 0;
      out.time = `${pad(h + (pm ? 12 : 0))}:${pad(min)}`;
    }
  } else {
    const h24 = ex(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(?:hrs?|hours|ist)?\b/i, rest);
    if (h24) out.time = `${pad(+h24[1])}:${h24[2]}`;
  }
  return out;
}

/** IST wall time to an instant; null when the time was never stated. */
export function istInstant(date: string | null | undefined, time: string | null | undefined): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const stripPrefixes = (s: string) => s.replace(/^\s*((fw|fwd|re)\s*:\s*)+/i, "").trim();

const PERSONAL_SUBJECT = /(reminder|shortlist(ed)?\s*(result|status|list)|result|application\s+(submitted|received|withdrawn|status|confirmation)|your application|interview|offer|congratulations|selected)/i;
const PERSONAL_BODY = /(you have (been|not been) shortlisted|your application (has been|was|is)|successfully (submitted|applied)|thank you for applying|we regret to inform)/i;

export type Classification = { kind: "broadcast" | "modified" } | { kind: null; reason: string };

export function classifyCas(subjectRaw: string, text: string): Classification {
  const subject = stripPrefixes(decodeWords(subjectRaw));
  const modified = /job details modified/i.test(subject);
  const broadcast = /\bbroadcast(ed)?\b/i.test(subject);
  if (!modified && !broadcast) return { kind: null, reason: "not_job_template" };
  const subjectWithoutStatus = subject.replace(/job details modified|broadcast(ed)?/gi, "");
  if (PERSONAL_SUBJECT.test(subjectWithoutStatus) && !/\|/.test(subjectWithoutStatus)) return { kind: null, reason: "personal_or_reminder" };
  if (/^\s*(reminder|gentle reminder)\b/i.test(subjectWithoutStatus)) return { kind: null, reason: "personal_or_reminder" };
  if (PERSONAL_BODY.test(text)) return { kind: null, reason: "personal_or_reminder" };
  return { kind: modified ? "modified" : "broadcast" };
}

const LABEL_SEP = String.raw`\s*(?:[:\t|]+\s*|\s+-\s+|\s+(?=\d))`;
const QUAL = String.raw`(?:(new|revised|updated|modified|old|previous|earlier|existing)\s+)?`;
const LABELS = {
  company: new RegExp(String.raw`^\s*${QUAL}(company(?:\s+name)?|organi[sz]ation|recruiter)${LABEL_SEP}(.+)$`, "i"),
  role: new RegExp(String.raw`^\s*${QUAL}(role|job\s+title|job\s+role|job\s+profile|position|profile|designation)(?:\s+name)?${LABEL_SEP}(.+)$`, "i"),
  deadline: new RegExp(String.raw`^\s*${QUAL}(application\s+(?:deadline|end\s+date|closing\s+date|close\s+date|due\s+date)|last\s+date\s+(?:to|for)\s+apply(?:ing)?|apply\s+by|deadline(?:\s+to\s+apply)?)(?:\s*\(.*?\))?${LABEL_SEP}(.+)$`, "i"),
  shortlist: new RegExp(String.raw`^\s*${QUAL}((?:expected|tentative)\s+shortlist(?:\s+release)?(?:\s+date)?|shortlist\s+(?:release\s+)?date)(?:\s*\(.*?\))?${LABEL_SEP}(.+)$`, "i"),
};

const EMPTY = /^(tbd|tba|na|n\/a|nil|none|-+|not\s+applicable|to be (?:announced|decided|confirmed))\.?$/i;

function changeValue(v: string): { old?: string; value: string } {
  const from = ex(/\bfrom\s+(.+?)\s+to\s+(.+)$/i, v);
  if (from) return { old: from[1].trim(), value: from[2].trim() };
  const arrow = ex(/^(.+?)\s*(?:->|→|=>)\s*(.+)$/, v);
  if (arrow) return { old: arrow[1].trim(), value: arrow[2].trim() };
  return { value: v.trim() };
}

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s"'“”]+|[\s"'“”.]+$/g, "").slice(0, 200);

export function extractCas(subjectRaw: string, text: string, kind: "broadcast" | "modified", html = ""): ParsedJobEvent | null {
  if (kind === "modified") {
    const real = extractModified(subjectRaw, text, html);
    if (real) return real;
  }
  const subject = stripPrefixes(decodeWords(subjectRaw));
  const parts = subject.split("|").map((s) => s.trim()).filter(Boolean);
  let subjectRole: string | null = null;
  let subjectCompany: string | null = null;
  if (parts.length >= 3) {
    subjectCompany = parts[parts.length - 2] ?? null;
    subjectRole = parts.slice(0, parts.length - 2).join(" | ");
  }

  let company: string | null = null;
  let role: string | null = null;
  let oldRole: string | null = null;
  let newRole: string | null = null;
  const deadline: DateParts = {};
  let shortlist: string | undefined;

  for (const line of text.split(/\r?\n/).slice(0, 400)) {
    if (/^\s*>/.test(line)) continue;
    let m: M | null;
    if ((m = ex(LABELS.company, line)) && !company) {
      const v = changeValue(m[3]).value;
      if (!EMPTY.test(v)) company = clean(v);
    } else if ((m = ex(LABELS.role, line))) {
      const q = (m[1] ?? "").toLowerCase();
      const cv = changeValue(m[3]);
      if (EMPTY.test(cv.value)) continue;
      if (/old|previous|earlier|existing/.test(q)) oldRole = clean(cv.value);
      else if (cv.old) {
        oldRole = clean(cv.old);
        newRole = clean(cv.value);
      } else if (/new|revised|updated|modified/.test(q)) newRole = clean(cv.value);
      else if (!role) role = clean(cv.value);
    } else if ((m = ex(LABELS.deadline, line))) {
      if (/old|previous|earlier|existing/i.test(m[1] ?? "")) continue;
      const parsed = parseDateParts(changeValue(m[3]).value);
      if (parsed.date) deadline.date = parsed.date;
      if (parsed.time) deadline.time = parsed.time;
    } else if ((m = ex(LABELS.shortlist, line))) {
      if (/old|previous|earlier|existing/i.test(m[1] ?? "")) continue;
      const parsed = parseDateParts(changeValue(m[3]).value);
      if (parsed.date) shortlist = parsed.date;
    }
  }

  company = company ?? (subjectCompany ? clean(subjectCompany) : null);
  if (!company) return null;
  const event: ParsedJobEvent = { kind, company, role: null };
  if (kind === "modified" && oldRole && newRole && oldRole.toLowerCase() !== newRole.toLowerCase()) {
    event.rename = { from: oldRole, to: newRole };
    event.role = newRole;
  } else {
    event.role = newRole ?? role ?? (subjectRole ? clean(subjectRole) : null);
  }
  if (deadline.date || deadline.time) event.deadline = deadline;
  if (shortlist) event.shortlist = { date: shortlist };
  if (kind === "broadcast" && !event.role) return null;
  return event;
}

export type ChangeRow = { field: string; previous: string; present: string };

const cellText = (h: string) =>
  htmlToText(h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n"))
    .split("\n").map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim()).filter(Boolean).join("\n");

/**
 * The real CAS "Job Details Modified" table: Field | Previous Value | Present Value.
 * Reads the innermost HTML table holding that header (values may span lines); plain-text fallback
 * accepts only unambiguous single-line rows separated by tabs or 2+ spaces.
 */
export function changeTable(html: string, text: string): ChangeRow[] | null {
  const lower = html.toLowerCase();
  const at = lower.search(/<t[hd][^>]*>\s*previous\s+value\s*<\/t[hd]>/);
  if (at >= 0) {
    const start = lower.lastIndexOf("<table", at);
    const end = lower.indexOf("</table>", at);
    if (start >= 0 && end > at) {
      const rows = [...html.slice(start, end).matchAll(/<tr[\s\S]*?<\/tr>/gi)]
        .slice(0, 200)
        .map((r) => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1] ?? "")));
      const head = (rows[0] ?? []).map((c) => c.toLowerCase());
      if (head[0] === "field" && /previous/.test(head[1] ?? "") && /present|current|new/.test(head[2] ?? "")) {
        return rows.slice(1).filter((r) => r.length >= 3).map((r) => ({ field: r[0]!, previous: r[1]!, present: r[2]! }));
      }
    }
  }
  const lines = text.split(/\r?\n/);
  const h = lines.findIndex((l) => /^\s*field(?:\t+| {2,})previous value(?:\t+| {2,})present value\s*$/i.test(l));
  if (h < 0) return null;
  const out: ChangeRow[] = [];
  for (const l of lines.slice(h + 1, h + 50)) {
    const cells = l.trim().split(/\t+| {2,}/);
    if (cells.length !== 3) break;
    out.push({ field: cells[0]!, previous: cells[1]!, present: cells[2]! });
  }
  return out;
}

const ROLE_FIELDS = /^(job title|title|role|role name|job role|designation|position)$/;
const TIME_FIELDS = /^((application )?(deadline|end|closing) time|time)$/;
const DATE_FIELDS = /^((application )?(deadline|end|closing) date|date|last date( to apply)?)$/;
const BOTH_FIELDS = /^(application )?deadline$/;

/** Identity from "The following details of the Role - <role> for <company> has been modified", checked against the subject. */
function modifiedIdentity(subjectRaw: string, text: string): { company: string; role: string } | null {
  const m = /details of the role\s*-\s*(.+?)\s+has been modified/i.exec(text.replace(/\s+/g, " "));
  if (!m?.[1]) return null;
  const s = m[1];
  const subject = stripPrefixes(decodeWords(subjectRaw)).replace(/\s*-\s*job details modified\s*$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
  const cuts: number[] = [];
  for (let i = s.indexOf(" for "); i >= 0; i = s.indexOf(" for ", i + 1)) cuts.push(i);
  for (const k of cuts) {
    const role = s.slice(0, k).trim();
    const company = s.slice(k + 5).trim();
    if (subject === `${company} - ${role}`.toLowerCase()) return { company: clean(company), role: clean(role) };
  }
  if (cuts.length === 1) return { company: clean(s.slice(cuts[0]! + 5)), role: clean(s.slice(0, cuts[0])) };
  return null;
}

function extractModified(subjectRaw: string, text: string, html: string): ParsedJobEvent | null {
  const id = modifiedIdentity(subjectRaw, text);
  if (!id) return null;
  const event: ParsedJobEvent = { kind: "modified", company: id.company, role: id.role };
  const deadline: DateParts = {};
  for (const row of changeTable(html, text) ?? []) {
    const f = row.field.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    const present = row.present.trim();
    if (!present || EMPTY.test(present)) continue; // never erase a known fact
    if (ROLE_FIELDS.test(f)) {
      const from = clean(row.previous);
      const to = clean(present);
      if (from && from.toLowerCase() !== to.toLowerCase()) event.rename = { from, to };
      event.role = to;
    } else if (/shortlist/.test(f)) {
      const d = parseDateParts(present).date;
      if (d) event.shortlist = { date: d };
    } else if (TIME_FIELDS.test(f) || DATE_FIELDS.test(f) || BOTH_FIELDS.test(f)) {
      const parsed = parseDateParts(present);
      if (!TIME_FIELDS.test(f) && parsed.date) deadline.date = parsed.date;
      if (!DATE_FIELDS.test(f) && parsed.time) deadline.time = parsed.time;
    }
  }
  if (deadline.date || deadline.time) event.deadline = deadline;
  return event;
}

const ORIGINAL_SENDER = "cas@isb.edu";

/**
 * Finds the original CAS message: a forwarded .eml attachment (bounded nesting), the message itself,
 * or Outlook's inline "From: / Sent: / Subject:" block as a fallback.
 */
export function findOriginal(root: MimePart, sender = ORIGINAL_SENDER): OriginalMessage | null {
  const fromHeaders = (msg: MimePart, via: OriginalMessage["via"]): OriginalMessage => ({
    from: bareAddress(msg.headers["from"]),
    subject: decodeWords(msg.headers["subject"] ?? ""),
    sentAt: parseSent(msg.headers["date"]),
    messageId: msg.headers["message-id"]?.trim() || null,
    text: bodyText(msg),
    html: bodyHtml(msg),
    attachments: fileAttachments(msg),
    via,
  });

  const queue: { msg: MimePart; depth: number }[] = [{ msg: root, depth: 0 }];
  while (queue.length) {
    const { msg, depth } = queue.shift()!;
    if (bareAddress(msg.headers["from"]) === sender) return fromHeaders(msg, depth === 0 ? "direct" : "attachment");
    if (depth >= MAX_DEPTH) continue;
    const walk = (p: MimePart) => {
      if (p.message) queue.push({ msg: p.message, depth: depth + 1 });
      p.children.forEach(walk);
    };
    walk(msg);
  }

  const inline = findInline(bodyText(root), sender);
  return inline ? { ...inline, html: bodyHtml(root), attachments: fileAttachments(root), via: "inline" } : null;
}

export function findInline(text: string, sender = ORIGINAL_SENDER): Omit<OriginalMessage, "attachments" | "via"> | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*>+\s?/, ""));
  for (let i = 0, blocks = 0; i < lines.length && blocks < MAX_DEPTH * 2; i++) {
    const fm = ex(/^\s*\*?From:\*?\s*(.+)$/i, lines[i]);
    if (!fm) continue;
    blocks++;
    let subject = "";
    let sent: string | null = null;
    let j = i + 1;
    for (; j < Math.min(lines.length, i + 10); j++) {
      const l = lines[j] ?? "";
      const s = ex(/^\s*\*?Subject:\*?\s*(.*)$/i, l);
      const d = ex(/^\s*\*?(Sent|Date):\*?\s*(.+)$/i, l);
      if (d) sent = d[2].trim();
      if (s) {
        subject = s[1].trim();
        j++;
        break;
      }
    }
    if (!subject || bareAddress(fm[1]) !== sender) continue;
    return {
      from: sender,
      subject,
      sentAt: parseSent(sent),
      messageId: null,
      text: lines.slice(j).join("\n"),
    };
  }
  return null;
}

function parseSent(value: string | null | undefined): string | null {
  if (!value) return null;
  const native = new Date(value.replace(/^[A-Za-z]+,\s*/, ""));
  if (!Number.isNaN(native.getTime())) return native.toISOString();
  const parts = parseDateParts(value);
  return istInstant(parts.date, parts.time ?? "00:00");
}
