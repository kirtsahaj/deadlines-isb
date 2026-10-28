import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { clearPersistedQueryCache, persistQueryCache, restoreQueryCache } from "../queryPersist";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { localStorage: fakeStorage(), setTimeout, clearTimeout });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: () => {}, removeEventListener: () => {} });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("saved screens", () => {
  it("restores the same user's data on the next open, but never another user's", () => {
    const first = new QueryClient();
    const stop = persistQueryCache(first, "u1");
    first.setQueryData(["deadlines", "u1"], [{ id: "a" }]);
    first.setQueryData(["admin-metrics"], { secret: true });
    vi.advanceTimersByTime(1100);
    stop();

    const other = new QueryClient();
    expect(restoreQueryCache(other, "u2")).toBe(false);
    expect(other.getQueryData(["deadlines", "u1"])).toBeUndefined();

    // The mismatch discarded the save; save again and reopen as the right user.
    const again = persistQueryCache(first, "u1");
    first.setQueryData(["deadlines", "u1"], [{ id: "a" }, { id: "b" }]);
    vi.advanceTimersByTime(1100);
    again();
    const next = new QueryClient();
    expect(restoreQueryCache(next, "u1")).toBe(true);
    expect(next.getQueryData(["deadlines", "u1"])).toEqual([{ id: "a" }, { id: "b" }]);
    expect(next.getQueryData(["admin-metrics"])).toBeUndefined();
  });

  it("drops a save older than a day, and sign-out clears it", () => {
    const qc = new QueryClient();
    const stop = persistQueryCache(qc, "u1");
    qc.setQueryData(["jobs"], { jobs: [] });
    vi.advanceTimersByTime(1100);
    stop();
    vi.setSystemTime(Date.now() + 25 * 3600_000);
    expect(restoreQueryCache(new QueryClient(), "u1")).toBe(false);

    const stop2 = persistQueryCache(qc, "u1");
    qc.setQueryData(["jobs"], { jobs: [1] });
    vi.advanceTimersByTime(1100);
    stop2();
    clearPersistedQueryCache();
    expect(restoreQueryCache(new QueryClient(), "u1")).toBe(false);
  });
});
