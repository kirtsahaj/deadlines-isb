import { describe, expect, it } from "vitest";
import { recipientLists, recipientsRss, SENDER } from "../recipients";

const rosters = [
  { campus: "Mohali" as const, emails: ["A@isb.edu", "b@isb.edu", SENDER, "a@isb.edu"] },
  { campus: "Hyderabad" as const, emails: ["c@isb.edu", "d@isb.edu"] },
];

describe("mail recipient lists", () => {
  it("drops opted-out people (any case), the sender and duplicates, per campus", () => {
    expect(recipientLists(rosters, ["D@ISB.EDU"])).toEqual([
      { campus: "Mohali", emails: ["a@isb.edu", "b@isb.edu"] },
      { campus: "Hyderabad", emails: ["c@isb.edu"] },
    ]);
  });
  it("gives each mail its own list: opting out of one mail doesn't affect the other", () => {
    const optOuts = { jobs: ["b@isb.edu"], birthday: [] as string[] };
    expect(recipientLists(rosters, optOuts.jobs)[0]!.emails).toEqual(["a@isb.edu"]);
    expect(recipientLists(rosters, optOuts.birthday)[0]!.emails).toEqual(["a@isb.edu", "b@isb.edu"]);
  });
  it("serves one RSS item per campus with a semicolon list and its count", () => {
    const xml = recipientsRss("jobs", recipientLists(rosters, []), Date.parse("2026-10-31T12:00:00Z"), "https://x.app");
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<description><![CDATA[a@isb.edu;b@isb.edu]]></description>");
    expect(xml).toContain("<category>2</category>");
    expect(xml).toContain("<title><![CDATA[Hyderabad]]></title>");
  });
});
