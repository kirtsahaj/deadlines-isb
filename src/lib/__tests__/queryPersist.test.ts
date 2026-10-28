import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { clearPersistedQueryCache, isPlainJson, persistQueryCache, restoreQueryCache } from "../queryPersist";

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

describe("only plain data is saved", () => {
  it("rejects Sets, Maps and Dates that would come back broken", () => {
    expect(isPlainJson({ a: [1, "x", null, { b: true }] })).toBe(true);
    expect(isPlainJson(new Set(["k"]))).toBe(false);
    expect(isPlainJson({ m: new Map() })).toBe(false);
    expect(isPlainJson({ d: new Date() })).toBe(false);
  });
  it("skips a query whose data isn't plain, keeping the rest", () => {
    const qc = new QueryClient();
    const stop = persistQueryCache(qc, "u1");
    qc.setQueryData(["deadline-done", "u1"], new Set(["k"]));
    qc.setQueryData(["deadlines", "u1"], [{ id: "a" }]);
    vi.advanceTimersByTime(1100);
    stop();
    const next = new QueryClient();
    restoreQueryCache(next, "u1");
    expect(next.getQueryData(["deadline-done", "u1"])).toBeUndefined();
    expect(next.getQueryData(["deadlines", "u1"])).toEqual([{ id: "a" }]);
  });
});
