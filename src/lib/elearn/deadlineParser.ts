export type ParsedDeadline = {
  timestamp: number;
  dueIso: string;
  keyword: string;
  precision: "explicit_12_hour" | "explicit_24_hour" | "assumed_end_of_day";
  text: string;
};

const KEYWORD = /(deadlines?|assignments?|due\s*dates?|submissions?)/gi;
const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const DATE_DMY = /(?<day>\d{1,2})(?:st|nd|rd|th)?[\s,/-]+(?<month>[A-Za-z]{3,9})[\s,/-]+(?<year>20\d{2})/i;
const DATE_MDY = /(?<month>[A-Za-z]{3,9})[\s,/-]+(?<day>\d{1,2})(?:st|nd|rd|th)?[\s,/-]+(?<year>20\d{2})/i;
const DATE_ISO = /(?<year>20\d{2})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])/;
const DATE_NUMERIC_IN = /(?<day>0?[1-9]|[12]\d|3[01])\/(?<month>0?[1-9]|1[0-2])\/(?<year>20\d{2})/;
const TIME_12 = /(?<!\d)(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<ampm>am|pm)\b/i;
const TIME_24 = /(?<!\d)(?<hhmm>[01]?\d[0-5]\d)\s*(?:hrs?|hours?)\b/i;
const TIME_24_COLON = /(?<!\d)(?<hour>[01]?\d|2[0-3]):(?<minute>[0-5]\d)(?!\s*(?:am|pm))/i;
const MARKER_SEGMENT = /#deadline#([\s\S]*?)(?:#deadline#|$)/gi;

export function stripApiMarkup(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function dateParts(window: string): { year: number; month: number; day: number } | null {
  const textual = DATE_DMY.exec(window) ?? DATE_MDY.exec(window);
  if (textual?.groups) {
    const month = MONTHS[textual.groups["month"]!.toLowerCase()];
    if (month === undefined) return null;
    return { year: Number(textual.groups["year"]), month, day: Number(textual.groups["day"]) };
  }
  const iso = DATE_ISO.exec(window);
  if (iso?.groups) {
    return {
      year: Number(iso.groups["year"]),
      month: Number(iso.groups["month"]) - 1,
      day: Number(iso.groups["day"]),
    };
  }
  const numeric = DATE_NUMERIC_IN.exec(window);
  if (numeric?.groups) {
    return {
      year: Number(numeric.groups["year"]),
      month: Number(numeric.groups["month"]) - 1,
      day: Number(numeric.groups["day"]),
    };
  }
  return null;
}

function timeParts(window: string): {
  hour: number;
  minute: number;
  precision: ParsedDeadline["precision"];
} {
  const hour24 = TIME_24.exec(window);
  if (hour24?.groups) {
    const raw = hour24.groups["hhmm"]!.padStart(4, "0");
    return {
      hour: Number(raw.slice(0, 2)),
      minute: Number(raw.slice(2)),
      precision: "explicit_24_hour",
    };
  }
  const hour12 = TIME_12.exec(window);
  if (hour12?.groups) {
    let hour = Number(hour12.groups["hour"]) % 12;
    if (hour12.groups["ampm"]!.toLowerCase() === "pm") hour += 12;
    return {
      hour,
      minute: Number(hour12.groups["minute"] ?? 0),
      precision: "explicit_12_hour",
    };
  }
  const colon24 = TIME_24_COLON.exec(window);
  if (colon24?.groups) {
    return {
      hour: Number(colon24.groups["hour"]),
      minute: Number(colon24.groups["minute"]),
      precision: "explicit_24_hour",
    };
  }
  return { hour: 23, minute: 59, precision: "assumed_end_of_day" };
}

// Asia/Kolkata has no daylight-saving transitions. This converts local IST fields to UTC.
function istTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number | null {
  if (hour > 23 || minute > 59) return null;
  const utcMs = Date.UTC(year, month, day, hour, minute) - 330 * 60_000;
  const check = new Date(utcMs + 330 * 60_000);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(utcMs / 1000);
}

export function extractDeadlines(
  value: string | null | undefined,
  markerOnly = false,
): ParsedDeadline[] {
  const stripped = stripApiMarkup(value);
  const found = new Map<number, ParsedDeadline>();

  // Marker-only mode trusts nothing except text a teacher wrapped in #deadline#.
  if (markerOnly) {
    MARKER_SEGMENT.lastIndex = 0;
    for (const segment of stripped.matchAll(MARKER_SEGMENT)) {
      const window = (segment[1] ?? "").trim();
      const date = dateParts(window);
      if (!date) continue;
      const time = timeParts(window);
      const timestamp = istTimestamp(date.year, date.month, date.day, time.hour, time.minute);
      if (timestamp === null || found.has(timestamp)) continue;
      found.set(timestamp, {
        timestamp,
        dueIso: new Date(timestamp * 1000).toISOString(),
        keyword: "#deadline#",
        precision: time.precision,
        text: window,
      });
    }
    return [...found.values()];
  }

  const text = stripped;
  KEYWORD.lastIndex = 0;
  for (const match of text.matchAll(KEYWORD)) {
    const index = match.index ?? 0;
    const window = text.slice(
      Math.max(0, index - 40),
      Math.min(text.length, index + match[0].length + 180),
    );
    const date = dateParts(window);
    if (!date) continue;
    const time = timeParts(window);
    const timestamp = istTimestamp(date.year, date.month, date.day, time.hour, time.minute);
    if (timestamp === null) continue;
    if (!found.has(timestamp)) {
      found.set(timestamp, {
        timestamp,
        dueIso: new Date(timestamp * 1000).toISOString(),
        keyword: match[0].toLowerCase(),
        precision: time.precision,
        text: text.slice(index, Math.min(text.length, index + match[0].length + 180)),
      });
    }
  }
  return [...found.values()];
}
