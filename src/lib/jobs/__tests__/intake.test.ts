import { describe, expect, it } from "vitest";
import { bucketFor, intakeSummary, isLive, problemLabel, throughForwarder, type InboundRow } from "../intake";

const now = Date.parse("2026-10-28T10:00:00Z");
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const row = (p: Partial<InboundRow>): InboundRow => ({ id: p.id ?? "x", status: "processed", reason: "created", subject: "Job broadcast", received_at: ago(60), ...p });

describe("placements intake health", () => {
  it("sorts each email into one bucket", () => {
    expect(bucketFor(row({}), now)).toBe("added");
    expect(bucketFor(row({ reason: "updated" }), now)).toBe("updated");
    expect(bucketFor(row({ reason: "noop" }), now)).toBe("noChange");
    expect(bucketFor(row({ reason: "pending" }), now)).toBe("noChange");
    expect(bucketFor(row({ reason: "ambiguous" }), now)).toBe("attention");
    expect(bucketFor(row({ status: "ignored", reason: "personal_or_reminder" }), now)).toBe("ignored");
    expect(bucketFor(row({ status: "quarantined", reason: "unknown_forwarder" }), now)).toBe("rejected");
  });

  it("treats a still-received email as in progress at first, then as a failure", () => {
    expect(bucketFor(row({ status: "received", reason: null, received_at: ago(2) }), now)).toBe("inProgress");
    expect(bucketFor(row({ status: "received", reason: "error:raw_unavailable", received_at: ago(30) }), now)).toBe("attention");
  });

  it("counts the last week and lists problems newest first", () => {
    const { counts, problems } = intakeSummary(
      [
        row({ id: "a" }),
        row({ id: "b", reason: "updated" }),
        row({ id: "c", status: "quarantined", reason: "unparsed_template", received_at: ago(300) }),
        row({ id: "d", status: "received", reason: "error:raw_unavailable", received_at: ago(100) }),
        row({ id: "e", status: "received", reason: null, received_at: ago(1) }),
      ],
      now,
    );
    expect(counts).toEqual({ added: 1, updated: 1, noChange: 0, ignored: 0, rejected: 1, attention: 1 });
    expect(problems.map((p) => p.id)).toEqual(["d", "c"]);
    expect(problemLabel(problems[0]!)).toBe("Failed to process (raw_unavailable)");
    expect(problemLabel(problems[1]!)).toBe("Couldn't read the CAS email format");
  });

  it("only emails that came through your forward count towards Live", () => {
    expect(throughForwarder(row({}))).toBe(true);
    expect(throughForwarder(row({ status: "ignored", reason: "personal_or_reminder" }))).toBe(true);
    expect(throughForwarder(row({ status: "ignored", reason: "wrong_recipient" }))).toBe(false);
    expect(throughForwarder(row({ status: "quarantined", reason: "unknown_forwarder" }))).toBe(false);
  });

  it("shows Live for 48 hours after the last forwarded email", () => {
    expect(isLive(ago(47 * 60), now)).toBe(true);
    expect(isLive(ago(49 * 60), now)).toBe(false);
    expect(isLive(null, now)).toBe(false);
  });
});
