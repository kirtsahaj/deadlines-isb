import { describe, expect, it } from "vitest";
import { birthdayMail, birthdayRss, daysUntil, type BirthdayPerson } from "../birthdays";

const p = (name: string, month: number, day: number, campus: "Mohali" | "Hyderabad" = "Mohali"): BirthdayPerson => ({
  email: `${name.toLowerCase()}@isb.edu`,
  name,
  campus,
  month,
  day,
});
// 08:30 IST on Mon 2 Nov 2026
const now = Date.parse("2026-11-02T03:00:00Z");
const APP = "https://x.app";

describe("daysUntil", () => {
  const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
  it("wraps into next year", () => {
    expect(daysUntil({ month: 1, day: 2 }, utc(2026, 12, 30))).toBe(3);
    expect(daysUntil({ month: 12, day: 30 }, utc(2026, 12, 30))).toBe(0);
    expect(daysUntil({ month: 11, day: 1 }, utc(2026, 11, 2))).toBe(364);
  });
  it("shows 29 Feb birthdays on 28 Feb in non-leap years", () => {
    expect(daysUntil({ month: 2, day: 29 }, utc(2027, 2, 28))).toBe(0);
    expect(daysUntil({ month: 2, day: 29 }, utc(2028, 2, 28))).toBe(1);
  });
});

describe("birthday mail", () => {
  const people = [p("Asha", 11, 2), p("Ravi", 11, 4), p("Zoe", 11, 6), p("Far", 11, 9), p("Hyd", 11, 2, "Hyderabad")];

  it("lists today, then the next 4 days, for one campus, with subject as before", () => {
    const m = birthdayMail("Mohali", people, [], now, APP)!;
    expect(m.subject).toBe("ISB Co'27 Mohali Birthdays - 2 November");
    expect(m.today).toEqual(["Asha"]);
    expect(m.upcoming).toEqual(["Ravi", "Zoe"]); // 4 Nov and 6 Nov are within 4 days; 9 Nov is not
    expect(m.html).toContain("Today's Birthdays in Mohali campus");
    expect(m.html).toContain("4 Nov &mdash; Ravi");
    expect(m.html).toContain("email-settings?mail=hide_birthday");
    expect(m.html).not.toContain("Hyd");
  });

  it("widens to 7 days when the next 4 are empty", () => {
    const m = birthdayMail("Mohali", [p("Zoe", 11, 8), p("Far", 11, 12)], [], now, APP)!;
    expect(m.today).toEqual([]);
    expect(m.upcoming).toEqual(["Zoe"]);
    expect(m.html).not.toContain("Today's Birthdays");
  });

  it("leaves out hidden people and skips the day when there's nothing to say", () => {
    expect(birthdayMail("Mohali", people, ["asha@isb.edu", "ravi@isb.edu", "zoe@isb.edu"], now, APP)!.today).toEqual([]);
    expect(birthdayMail("Mohali", [p("Far", 11, 20)], [], now, APP)).toBeNull();
  });

  it("serves one RSS item per campus with something to say", () => {
    const mails = (["Mohali", "Hyderabad"] as const).map((c) => birthdayMail(c, people, [], now, APP)).filter((m) => m !== null);
    const xml = birthdayRss(mails, now, APP);
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<category>Hyderabad</category>");
  });
});
