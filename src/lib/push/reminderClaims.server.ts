import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { keyToUuid } from "@/lib/term5/userDeadlines.server";

/** Every source identity is claimed atomically; a unique conflict suppresses overlapping senders. */
export async function claimReminder(userId: string, keys: string[], dueAt: string): Promise<string | null> {
  const ids = [...new Set(await Promise.all(keys.map(k => keyToUuid(userId, k))))];
  const first = ids[0];
  if (!first) return null;
  const { data, error: readError } = await supabaseAdmin.from("deadline_notifications").select("deadline_id")
    .eq("user_id", userId).in("deadline_id", ids).eq("due_at", dueAt);
  if (readError || data?.length) return null;
  const { error } = await supabaseAdmin.from("deadline_notifications")
    .insert(ids.map(id => ({ user_id: userId, deadline_id: id, due_at: dueAt })));
  return error ? null : first;
}