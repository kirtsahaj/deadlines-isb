import { elearnBaseUrl } from "./config.server";
import { encryptToken } from "./crypto.server";
import { MoodleClient, MoodleError, readOnlyFunctions } from "./moodle.server";

export type ConnectResult = { ok: true; accountName: string | null } | { ok: false; error: string };

export async function connectElearnToken(userId: string, rawToken: string): Promise<ConnectResult> {
  const token = rawToken.trim();
  if (!/^[A-Za-z0-9]{16,128}$/.test(token)) return { ok: false, error: "invalid_elearn_key" };

  const baseUrl = elearnBaseUrl();
  try {
    const client = new MoodleClient(token);
    const site = (await client.call("core_webservice_get_site_info")) as Record<string, unknown>;
    if (typeof site["userid"] !== "number") throw new MoodleError("schema");
    const exposed = Array.isArray(site["functions"])
      ? (site["functions"] as unknown[])
          .map((item) => String((item as Record<string, unknown>)?.["name"] ?? ""))
          .filter(Boolean)
      : [];

    const encrypted = await encryptToken(token, userId, baseUrl);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("elearn_connections").upsert({
      user_id: userId,
      provider: "moodle",
      connection_mode: "manual_token",
      base_url: baseUrl,
      external_user_id: site["userid"],
      external_full_name: typeof site["fullname"] === "string" ? site["fullname"] : null,
      token_ciphertext: encrypted.ciphertext,
      token_iv: encrypted.iv,
      token_key_version: encrypted.keyVersion,
      exposed_functions: exposed.filter((name) => readOnlyFunctions.includes(name)),
      status: "connected",
      safe_error_code: null,
      consecutive_failures: 0,
      last_manual_sync_at: null,
      next_sync_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: "request_failed" };

    await supabaseAdmin.from("sync_queue").upsert({
      user_id: userId,
      run_after: new Date().toISOString(),
      priority: 10,
      locked_at: null,
      locked_by: null,
    });

    return {
      ok: true,
      accountName: typeof site["fullname"] === "string" ? site["fullname"] : null,
    };
  } catch (error) {
    const code = error instanceof MoodleError ? error.code : "request_failed";
    return {
      ok: false,
      error: ["invalidtoken", "credentials", "accessexception"].includes(code)
        ? "invalid_elearn_key"
        : code,
    };
  }
}

export async function purgeUserData(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const table of [
    // Remove the encrypted credential first so it never outlives purge intent.
    "elearn_connections",
    "sync_queue",
    "sync_runs",
    "deadline_items",
    "courses",
  ] as const) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error("database");
  }
}
