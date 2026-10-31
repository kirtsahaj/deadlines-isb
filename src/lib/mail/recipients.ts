/**
 * BCC lists for Kirt's daily batch mails ("jobs" = job deadlines digest, "birthday" = birthday
 * reminder), served to his Power Automate flows as a private RSS feed: one item per campus whose
 * description is a ready-to-paste "a@isb.edu;b@isb.edu;…" string. Each list is the campus class
 * list minus people who opted out of that mail (email_unsubscribes) and minus the sender (in To).
 * Pure and browser-safe so it can be tested; the class lists themselves stay server-only.
 */
export type MailKey = "jobs" | "birthday";
export const MAIL_KEYS: MailKey[] = ["jobs", "birthday"];
export const SENDER = "kirt_singh_pgp2027@isb.edu";

export type CampusList = { campus: "Mohali" | "Hyderabad"; emails: string[] };

export function recipientLists(
  rosters: { campus: CampusList["campus"]; emails: string[] }[],
  optedOut: Iterable<string>,
  exclude: Iterable<string> = [SENDER],
): CampusList[] {
  const skip = new Set([...optedOut, ...exclude].map((e) => e.toLowerCase().trim()));
  return rosters.map(({ campus, emails }) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of emails) {
      const e = raw.toLowerCase().trim();
      if (!e || skip.has(e) || seen.has(e)) continue;
      seen.add(e);
      out.push(e);
    }
    return { campus, emails: out };
  });
}

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export function recipientsRss(mail: MailKey, lists: CampusList[], now: number, appUrl: string): string {
  const stamp = new Date(now).toUTCString();
  const day = new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
  const items = lists
    .map(
      (l) =>
        `<item><title>${cdata(l.campus)}</title><link>${appUrl}/email-settings?mail=${mail}</link>` +
        `<guid isPermaLink="false">recipients-${mail}-${l.campus.toLowerCase()}-${day}</guid><pubDate>${stamp}</pubDate>` +
        `<category>${l.emails.length}</category><description>${cdata(l.emails.join(";"))}</description></item>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>` +
    `<title>${cdata(`BCC lists: ${mail}`)}</title><link>${appUrl}</link>` +
    `<description>Recipients for the ${mail} mail, opt-outs removed</description><lastBuildDate>${stamp}</lastBuildDate>` +
    `${items}</channel></rss>`
  );
}
