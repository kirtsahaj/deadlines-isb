import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Claims = { email?: unknown };

function claimEmail(claims: unknown): string {
  const value = (claims as Claims | undefined)?.email;
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

async function assertAllowed(claims: unknown): Promise<string> {
  const { emailAllowed } = await import("./elearn/config.server");
  const email = claimEmail(claims);
  if (!emailAllowed(email)) throw new Error("email_domain_not_allowed");
  return email;
}

/** Public: the UI never hardcodes the final domain. */
export const getAccessPolicy = createServerFn({ method: "GET" }).handler(async () => {
  const { allowedEmailDomains } = await import("./elearn/config.server");
  const { manualCooldownSeconds, syncIntervalMinutes } = await import("./elearn/config.server");
  return {
    allowedDomains: allowedEmailDomains(),
    manualCooldownSeconds: manualCooldownSeconds(),
    syncIntervalMinutes: syncIntervalMinutes(),
  };
});

export const getAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { emailAllowed, allowedEmailDomains } = await import("./elearn/config.server");
    const email = claimEmail(context.claims);
    const allowed = emailAllowed(email);
    if (allowed) {
      await context.supabase.rpc("ensure_current_user_bootstrapped");
    }
    return { allowed, email, allowedDomains: allowedEmailDomains() };
  });

/** Safe connection metadata only. Never ciphertext, IV, key version or token. */
export const getConnectionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAllowed(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("elearn_connections")
      .select(
        "status, external_full_name, last_success_at, last_attempt_at, last_manual_sync_at, next_sync_at, consecutive_failures, safe_error_code, connection_mode",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { connected: false as const };
    return {
      connected: true as const,
      status: data.status,
      accountName: data.external_full_name,
      lastSuccessAt: data.last_success_at,
      lastAttemptAt: data.last_attempt_at,
      lastManualSyncAt: data.last_manual_sync_at,
      nextSyncAt: data.next_sync_at,
      consecutiveFailures: data.consecutive_failures,
      safeErrorCode: data.safe_error_code,
      connectionMode: data.connection_mode,
    };
  });

export const connectElearn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) =>
    z.object({ token: z.string().min(16).max(128) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAllowed(context.claims);
    const { connectElearnToken } = await import("./elearn/connection.server");
    const result = await connectElearnToken(context.userId, data.token);
    if (!result.ok) return { connected: false as const, error: result.error };
    const { runSync } = await import("./elearn/sync.server");
    const sync = await runSync(context.userId, "first_connect");
    return {
      connected: true as const,
      accountName: result.accountName,
      firstSync: sync.ok ? sync.outcome : "failed",
    };
  });

export const syncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAllowed(context.claims);
    const { runSync } = await import("./elearn/sync.server");
    const result = await runSync(context.userId, "manual");
    return result;
  });

export const disconnectElearn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAllowed(context.claims);
    const { purgeUserData } = await import("./elearn/connection.server");
    await purgeUserData(context.userId);
    return { disconnected: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { confirmation: string }) =>
    z.object({ confirmation: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.confirmation !== "DELETE MY ACCOUNT") {
      return { deleted: false as const, error: "confirmation_required" };
    }
    const { purgeUserData } = await import("./elearn/connection.server");
    await purgeUserData(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) return { deleted: false as const, error: "delete_failed" };
    return { deleted: true as const };
  });
