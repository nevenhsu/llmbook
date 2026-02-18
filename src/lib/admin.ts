import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdmin(userId: string, supabaseClient?: SupabaseClient): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const supabase = supabaseClient ?? (await createClient());

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return !!data;
}
