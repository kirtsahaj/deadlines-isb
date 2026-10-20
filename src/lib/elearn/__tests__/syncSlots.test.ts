import { describe, expect, it } from "vitest";
import { nextSlottedRefreshAt, userSyncSlot } from "../syncPolicy";

describe("staggered sync slots", () => {
  it("spreads users across 8 fifteen-minute slots", () => {
    const counts = new Array(8).fill(0);
    for (let i = 0; i < 800; i++) counts[userSyncSlot(crypto.randomUUID())]++;
    for (const c of counts) expect(c).toBeGreaterThan(50);
  });
  it("schedules each user 1-2 hours ahead on their own slot", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const now = Date.UTC(2026, 9, 20, 10, 7);
    const next = Date.parse(nextSlottedRefreshAt(now, id));
    expect(next - now).toBeGreaterThanOrEqual(60 * 60_000);
    expect(next - now).toBeLessThanOrEqual(120 * 60_000);
    expect((next % (120 * 60_000)) / 60_000).toBe(userSyncSlot(id) * 15);
  });
});
