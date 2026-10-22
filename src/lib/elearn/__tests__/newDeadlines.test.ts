import { describe, expect, it } from "vitest";
import { selectNewDeadlineAlerts } from "../newDeadlines";
import { normalizeDeadlines } from "../normalize";

const now = Date.parse("2026-10-22T00:00:00Z");
const row = (key: string, due: string | null) => ({ external_key: key, due_at: due, title: key, moodle_course_id: 1 });

describe("new deadline alerts", () => {
  it("only alerts for unseen, upcoming deadlines", () => {
    const out = selectNewDeadlineAlerts(
      [row("a", "2026-10-23T00:00:00Z"), row("b", "2026-10-23T00:00:00Z"), row("c", "2026-10-21T00:00:00Z"), row("d", null)],
      new Set(["a"]),
      now,
    );
    expect(out.map((r) => r.external_key)).toEqual(["b"]);
  });
  it("caps alerts at 3 per sync", () => {
    const rows = ["a", "b", "c", "d", "e"].map((k) => row(k, "2026-10-25T00:00:00Z"));
    expect(selectNewDeadlineAlerts(rows, new Set(), now)).toHaveLength(3);
  });
});

describe("choice deadlines", () => {
  it("captures a choice close time from course contents dates", () => {
    const close = Math.floor(Date.parse("2026-10-22T16:30:00Z") / 1000);
    const rows = normalizeDeadlines({
      assignments: {}, submissions: new Map(), quizzes: {}, forums: [], calendar: {},
      contents: new Map([[7, [{ id: 1, modules: [{ modname: "choice", instance: 55, name: "Project Group Selection_G", dates: [{ dataid: "timeclose", timestamp: close }] }] }]]]),
      nowSeconds: close - 3600,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "choice", title: "Project Group Selection_G", due_at: "2026-10-22T16:30:00.000Z" });
  });
});
