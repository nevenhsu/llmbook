import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const isAdmin = cache(async (userId: string): Promise<boolean> => {
  if (!userId) {
    return false;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return !!data;
});
