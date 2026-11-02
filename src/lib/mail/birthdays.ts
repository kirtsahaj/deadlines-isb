/**
 * Birthday reminder mail (replaces the Google Sheets + Apps Script version), built per campus
 * for Kirt's morning Power Automate flow. Same rules as the old script: today's birthdays, then
 * "Coming up" for the next 4 days, widened to 7 if those are empty. Changes on purpose: no fun
 * facts, no mail when there's nothing to say, people who chose "Hide my birthday" are left out,
 * and the year-end wrap works (early-January birthdays show up in late December).
 * Only day + month are stored. Pure and browser-safe so it can be tested.
 */
export type Campus = "Mohali" | "Hyderabad";
export type BirthdayPerson = { email: string; name: string; campus: Campus; month: number; day: number };
export type BirthdayMail = { campus: Campus; subject: string; html: string; today: string[]; upcoming: string[] };

const DAY = 86_400_000;
const COHORT = "ISB Co'27";

/** Today's calendar date in India as a UTC-midnight timestamp. */
function istToday(now: number): number {
  const d = new Date(now + 5.5 * 3600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Days from today until the next birthday (0 = today). 29 Feb falls on 28 Feb in other years. */
export function daysUntil(person: { month: number; day: number }, today: number): number {
  const year = new Date(today).getUTCFullYear();
  const at = (y: number) => {
    const day = person.month === 2 && person.day === 29 && !isLeap(y) ? 28 : person.day;
    return Date.UTC(y, person.month - 1, day);
  };
  const thisYear = at(year);
  return Math.round(((thisYear >= today ? thisYear : at(year + 1)) - today) / DAY);
}

const fmt = (ms: number, month: "short" | "long") =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month, timeZone: "UTC" }).format(ms);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function birthdayMail(
  campus: Campus,
  people: BirthdayPerson[],
  hidden: Iterable<string>,
  now: number,
  appUrl: string,
): BirthdayMail | null {
  const skip = new Set([...hidden].map((e) => e.toLowerCase()));
  const today = istToday(now);
  const mine = people
    .filter((p) => p.campus === campus && !skip.has(p.email.toLowerCase()))
    .map((p) => ({ ...p, diff: daysUntil(p, today) }));

  const todays = mine.filter((p) => p.diff === 0);
  const ahead = mine.filter((p) => p.diff > 0).sort((a, b) => a.diff - b.diff || a.name.localeCompare(b.name));
  let upcoming = ahead.filter((p) => p.diff < 5);
  if (!upcoming.length) upcoming = ahead.filter((p) => p.diff < 8);
  if (!todays.length && !upcoming.length) return null;

  const line = (p: { name: string; diff: number }) => `${fmt(today + p.diff * DAY, "short")} &mdash; ${escapeHtml(p.name)}`;
  const parts: string[] = [];
  if (todays.length) {
    parts.push(`<p><b>Today's Birthdays in ${campus} campus</b></p><p>${todays.map(line).join("<br>")}</p>`);
  }
  parts.push(
    `<p><b>Coming up:</b></p><p>${upcoming.length ? upcoming.map(line).join("<br>") : `No upcoming birthdays in ${campus} campus`}</p>`,
  );
  const settings = `${appUrl}/email-settings`;
  parts.push(
    `<hr style="border:none;border-top:1px solid #d0d0d0;margin:16px 0;">` +
      `<p style="font-size:12px;color:#777777;">Don't want these mails? <a href="${settings}?mail=birthday">Unsubscribe</a> &middot; ` +
      `<a href="${settings}?mail=hide_birthday">Hide my birthday</a></p>` +
      `<p style="font-size:12px;color:#777777;">Track all your deadlines (assignments, prereads and job applications) in one place on the ISB Deadline Tracker: ` +
      `<a href="${appUrl}">deadlines-isb.lovable.app</a></p>`,
  );

  return {
    campus,
    subject: `${COHORT} ${campus} Birthdays - ${fmt(today, "long")}`,
    html: `<div style="font-family:sans-serif;font-size:14px;">${parts.join("")}</div>`,
    today: todays.map((p) => p.name),
    upcoming: upcoming.map((p) => p.name),
  };
}

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/** One RSS item per campus that has something to say: title = subject, description = HTML body. */
export function birthdayRss(mails: BirthdayMail[], now: number, appUrl: string): string {
  const stamp = new Date(now).toUTCString();
  const day = new Date(istToday(now)).toISOString().slice(0, 10);
  const items = mails
    .map(
      (m) =>
        `<item><title>${cdata(m.subject)}</title><link>${appUrl}/email-settings?mail=birthday</link>` +
        `<guid isPermaLink="false">birthdays-${m.campus.toLowerCase()}-${day}</guid><pubDate>${stamp}</pubDate>` +
        `<category>${m.campus}</category><description>${cdata(m.html)}</description></item>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Birthday reminder mail</title>` +
    `<link>${appUrl}</link><description>Today's and upcoming birthdays per campus</description>` +
    `<lastBuildDate>${stamp}</lastBuildDate>${items}</channel></rss>`
  );
}
