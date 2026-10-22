import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ records: new Set<string>(), fail: false }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  let user = "", at = "", ids: string[] = [];
  const q = {
    select: () => q,
    eq: (name: string, value: string) => { if (name === "user_id") user = value; else at = value; return q; },
    in: (_: string, value: string[]) => { ids = value; return q; },
    then: (resolve: (v: unknown) => void) => resolve({ data: ids.filter(id => state.records.has(`${user}|${id}|${at}`)).map(deadline_id => ({ deadline_id })), error: state.fail ? new Error("read failed") : null }),
    insert: async (rows: { user_id: string; deadline_id: string; due_at: string }[]) => {
      const keys = rows.map(r => `${r.user_id}|${r.deadline_id}|${r.due_at}`);
      if (keys.some(k => state.records.has(k))) return { error: new Error("duplicate") };
      keys.forEach(k => state.records.add(k)); return { error: null };
    },
  }; return q;
} } }));
vi.mock("@/lib/term5/userDeadlines.server", () => ({ keyToUuid: async (user: string, key: string) => `${user}:${key}` }));
import { claimReminder } from "@/lib/push/reminderClaims.server";

beforeEach(() => { state.records.clear(); state.fail = false; });
it("claims both outline and eLearn identities once across discovery and schedule senders", async () => {
  expect(await claimReminder("u", ["own", "outline"], "2026-10-23T14:05:00+05:30")).toBe("u:own");
  expect(await claimReminder("u", ["outline"], "2026-10-23T14:05:00+05:30")).toBeNull();
  expect(await claimReminder("u", ["own"], "2026-10-23T14:05:00+05:30")).toBeNull();
});
it("allows one new reminder when the due time changes", async () => {
  await claimReminder("u", ["p1"], "2026-10-23T14:05:00+05:30");
  expect(await claimReminder("u", ["p1"], "2026-10-24T14:05:00+05:30")).toBe("u:p1");
});
it("keeps students' reminder claims isolated", async () => {
  await claimReminder("u1", ["p1"], "2026-10-23T14:05:00+05:30");
  expect(await claimReminder("u2", ["p1"], "2026-10-23T14:05:00+05:30")).toBe("u2:p1");
});
it("only one concurrent sender succeeds", async () => {
  const results = await Promise.all([claimReminder("u", ["p1"], "2026-10-23"), claimReminder("u", ["p1"], "2026-10-23")]);
  expect(results.filter(Boolean)).toHaveLength(1);
});
it("does not send when the claim lookup fails", async () => {
  state.fail = true;
  expect(await claimReminder("u", ["p1"], "2026-10-23")).toBeNull();
  expect(state.records.size).toBe(0);
});