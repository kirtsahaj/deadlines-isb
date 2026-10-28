import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readAlertSettings } from "./alerts";

async function assertSchoolUser(claims: unknown) {
  const { emailAllowed } = await import("./elearn/config.server");
  const email = (claims as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string" || !emailAllowed(email.toLowerCase().trim())) throw new Error("email_domain_not_allowed");
}

/** Account-wide on/off for each section's notifications (all default to on). */
export const getAlertSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSchoolUser(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("user_settings").select("*").eq("user_id", context.userId).maybeSingle();
    return readAlertSettings(data as Record<string, unknown> | null);
  });

export const setAlertSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ category: z.enum(["deadlines", "classes", "jobs"]), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSchoolUser(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_settings")
      .update(
        data.category === "deadlines"
          ? { deadline_reminders: data.enabled }
          : data.category === "classes"
            ? { class_reminders: data.enabled }
            : { job_reminders: data.enabled },
      )
      .eq("user_id", context.userId);
    if (error) throw new Error("setting_failed");
    return { ok: true };
  });

/** Turning notifications on for a device always switches every section back on. */
export const enableAllAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSchoolUser(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all = await supabaseAdmin
      .from("user_settings")
      .update({ deadline_reminders: true, class_reminders: true, job_reminders: true })
      .eq("user_id", context.userId);
    // Before the alert-categories migration exists, at least restore job alerts.
    if (all.error) await supabaseAdmin.from("user_settings").update({ job_reminders: true }).eq("user_id", context.userId);
    return { ok: true };
  });

/** Tick or untick an Assignments item. Keys are the item's stable identities (see doneKeys). */
export const setDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ keys: z.array(z.string().min(3).max(300)).min(1).max(5), done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSchoolUser(context.claims);
    if (data.done) {
      const { error } = await context.supabase
        .from("deadline_done")
        .upsert(data.keys.map((item_key) => ({ user_id: context.userId, item_key })), { onConflict: "user_id,item_key", ignoreDuplicates: true });
      if (error) throw new Error("done_failed");
    } else {
      const { error } = await context.supabase.from("deadline_done").delete().eq("user_id", context.userId).in("item_key", data.keys);
      if (error) throw new Error("done_failed");
    }
    return { ok: true };
  });
