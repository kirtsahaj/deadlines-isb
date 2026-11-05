/**
 * Nightly "applications closing soon" digest, read by the owner's Outlook automation
 * (Power Automate, 10 PM IST) as an RSS feed. Pure and browser-safe so it can be tested.
 *
 * Included: jobs with an exact deadline in the next 24 hours, plus date-only jobs closing
 * tomorrow (India time), shown with just the date: they go in the mail the night before,
 * not on the closing day itself. Sorted by closing time.
 */
export type DigestJob = {
  id: string;
  company: string;
  role: string | null;
  deadlineAt: string | null;
  deadlineDate: string | null;
};

const H = 3600_000;
const TZ = "Asia/Kolkata";
const istDate = (ms: number) => new Date(ms + 5.5 * H).toISOString().slice(0, 10);

/** When a job closes, for sorting: the exact time, or the end of the day (IST) for date-only ones. */
function closesAt(job: DigestJob): number {
  if (job.deadlineAt) return Date.parse(job.deadlineAt);
  return job.deadlineDate ? Date.parse(`${job.deadlineDate}T23:59:00+05:30`) : NaN;
}

export function jobsForDigest(jobs: DigestJob[], now: number): DigestJob[] {
  const today = istDate(now);
  const tomorrow = istDate(Date.parse(`${today}T12:00:00+05:30`) + 24 * H);
  return jobs
    .filter((j) => {
      if (j.deadlineAt) {
        const left = Date.parse(j.deadlineAt) - now;
        return left > 0 && left <= 24 * H;
      }
      return j.deadlineDate === tomorrow;
    })
    .sort((a, b) => closesAt(a) - closesAt(b) || a.company.localeCompare(b.company));
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function dayLabel(ms: number) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(ms);
}

export function closingLabel(job: DigestJob): string {
  if (job.deadlineAt) {
    const ms = Date.parse(job.deadlineAt);
    const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(ms);
    return `${dayLabel(ms)}, ${time}`;
  }
  return dayLabel(Date.parse(`${job.deadlineDate}T12:00:00+05:30`));
}

/** A simple numbered list for the mail body: company in bold, role, closing time. */
export function digestListHtml(jobs: DigestJob[]): string {
  const items = jobs
    .map((j) => `<li><b>${escapeHtml(j.company)}</b>${j.role ? ` &ndash; ${escapeHtml(j.role)}` : ""} &middot; closes ${escapeHtml(closingLabel(j))}</li>`)
    .join("");
  return `<ol>${items}</ol>`;
}

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

/**
 * RSS with one item holding the ready-made list, or no items when nothing closes
 * (the automation sends a mail only when there is an item).
 */
export function digestRss(jobs: DigestJob[], now: number, appUrl: string): string {
  const due = jobsForDigest(jobs, now);
  const stamp = new Date(now).toUTCString();
  const item = due.length
    ? `<item><title>${cdata(`${due.length} job application${due.length === 1 ? "" : "s"} closing in the next 24 hours`)}</title>` +
      `<link>${appUrl}/placements</link><guid isPermaLink="false">job-digest-${istDate(now)}-${due.length}</guid>` +
      `<pubDate>${stamp}</pubDate><description>${cdata(digestListHtml(due))}</description></item>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>` +
    `<title>ISB job applications closing soon</title><link>${appUrl}/placements</link>` +
    `<description>Job application deadlines in the next 24 hours</description><lastBuildDate>${stamp}</lastBuildDate>` +
    `${item}</channel></rss>`
  );
}
