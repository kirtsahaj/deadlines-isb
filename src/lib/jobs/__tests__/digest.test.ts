import { describe, expect, it } from "vitest";
import { digestListHtml, digestRss, jobsForDigest, type DigestJob } from "../digest";

// Thu 29 Oct 2026, 22:00 IST
const now = Date.parse("2026-10-29T16:30:00Z");
const H = 3600_000;
const at = (ms: number) => new Date(now + ms).toISOString();
const job = (o: Partial<DigestJob>): DigestJob => ({ id: o.company ?? "x", company: "Co", role: "Analyst", deadlineAt: null, deadlineDate: null, ...o });

describe("job digest", () => {
  it("keeps exact deadlines in the next 24h and date-only ones closing today or tomorrow (IST), soonest first", () => {
    const jobs = [
      job({ company: "Later", deadlineAt: at(25 * H) }),
      job({ company: "Passed", deadlineAt: at(-60_000) }),
      job({ company: "UBS", deadlineAt: at(19 * H) }), // Fri 5:00 pm
      job({ company: "Bain", deadlineAt: at(12 * H) }), // Fri 10:00 am
      job({ company: "YCP", deadlineDate: "2026-10-30" }),
      job({ company: "Today", deadlineDate: "2026-10-29" }),
      job({ company: "Saturday", deadlineDate: "2026-10-31" }),
    ];
    expect(jobsForDigest(jobs, now).map((j) => j.company)).toEqual(["Today", "Bain", "UBS", "YCP"]);
  });

  it("lists company, role and closing time, escaping text", () => {
    const html = digestListHtml([
      job({ company: "Bain & Company", role: "Associate <Consultant>", deadlineAt: at(12 * H) }),
      job({ company: "YCP", role: null, deadlineDate: "2026-10-30" }),
    ]);
    expect(html).toBe(
      "<ol><li><b>Bain &amp; Company</b> &ndash; Associate &lt;Consultant&gt; &middot; closes Fri, 30 Oct, 10:00 am</li>" +
        "<li><b>YCP</b> &middot; closes Fri, 30 Oct (no time given)</li></ol>",
    );
  });

  it("has one item when something closes and none otherwise", () => {
    const busy = digestRss([job({ company: "UBS", deadlineAt: at(5 * H) })], now, "https://x.app");
    expect(busy.match(/<item>/g)).toHaveLength(1);
    expect(busy).toContain("1 job application closing in the next 24 hours");
    expect(digestRss([job({ deadlineAt: at(30 * H) })], now, "https://x.app")).not.toContain("<item>");
  });
});
