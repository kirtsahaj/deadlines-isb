import { describe, expect, it } from "vitest";
import { isReminderDue } from "../push/vapid";

const now = new Date("2026-10-20T10:00:00Z");
const at = (mins: number) => new Date(now.getTime() + mins * 60_000);

describe("3-hour reminder window", () => {
  it("is due exactly 3 hours before", () => expect(isReminderDue(at(180), now)).toBe(true));
  it("is not due 3h15m before", () => expect(isReminderDue(at(195), now)).toBe(false));
  it("is not sent after the deadline passed", () => expect(isReminderDue(at(-1), now)).toBe(false));
});
