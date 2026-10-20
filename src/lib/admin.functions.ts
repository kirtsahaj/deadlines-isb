import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "./admin";

export type AdminUserRow = {
  userId: string;
  name: string | null;
  email: string | null;
  signInFirst: string | null;
  signInLast: string | null;
  openedFirst: string | null;
  openedLast: string | null;
  connected: boolean;
  connectionStatus: string | null;
  connectedFirst: string | null;
  connectedLast: string | null;
  syncFirst: string | null;
  syncLast: string | null;
  syncLastOutcome: string | null;
  successfulSyncLast: string | null;
  syncCount: number;
  activeDeadlines: number;
};

function minMax(acc: { min: string | null; max: string | null }, value: string | null) {
  if (!value) return acc;
  if (!acc.min || value < acc.min) acc.min = value;
  if (!acc.max || value > acc.max) acc.max = value;
  return acc;
}

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: unknown })?.email;
    if (!isAdminEmail(typeof email === "string" ? email : "")) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [usersRes, profilesRes, connRes, runsRes, itemsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("user_id, display_name, first_opened_at, last_active_at"),
      supabaseAdmin
        .from("elearn_connections")
        .select("user_id, status, external_full_name, created_at, updated_at, last_success_at"),
      supabaseAdmin
        .from("sync_runs")
        .select("user_id, started_at, outcome")
        .order("started_at", { ascending: true })
        .limit(20000),
      supabaseAdmin.from("deadline_items").select("user_id").eq("active", true).limit(50000),
    ]);
    if (usersRes.error) throw new Error("users_unavailable");

    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
    const conns = new Map((connRes.data ?? []).map((c) => [c.user_id, c]));
    const runs = new Map<string, { min: string | null; max: string | null; last: string | null; count: number }>();
    for (const r of runsRes.data ?? []) {
      const entry = runs.get(r.user_id) ?? { min: null, max: null, last: null, count: 0 };
      minMax(entry, r.started_at);
      entry.last = r.outcome;
      entry.count += 1;
      runs.set(r.user_id, entry);
    }
    const deadlines = new Map<string, number>();
    for (const d of itemsRes.data ?? []) deadlines.set(d.user_id, (deadlines.get(d.user_id) ?? 0) + 1);

    const rows: AdminUserRow[] = usersRes.data.users.map((u) => {
      const p = profiles.get(u.id);
      const c = conns.get(u.id);
      const r = runs.get(u.id);
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const metaName = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null;
      return {
        userId: u.id,
        name: p?.display_name ?? metaName ?? c?.external_full_name ?? null,
        email: u.email ?? null,
        signInFirst: u.created_at ?? null,
        signInLast: u.last_sign_in_at ?? null,
        openedFirst: p?.first_opened_at ?? null,
        openedLast: p?.last_active_at ?? null,
        connected: !!c,
        connectionStatus: c?.status ?? null,
        connectedFirst: c?.created_at ?? null,
        connectedLast: c?.updated_at ?? null,
        syncFirst: r?.min ?? null,
        syncLast: r?.max ?? null,
        syncLastOutcome: r?.last ?? null,
        successfulSyncLast: c?.last_success_at ?? null,
        syncCount: r?.count ?? 0,
        activeDeadlines: deadlines.get(u.id) ?? 0,
      };
    });
    rows.sort((a, b) => (b.signInLast ?? "").localeCompare(a.signInLast ?? ""));
    return { rows, generatedAt: new Date().toISOString() };
  });
