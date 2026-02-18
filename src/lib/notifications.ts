import { createClient } from "@/lib/supabase/server";

export async function createNotification(userId: string, type: string, payload: unknown) {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    payload,
  });
  return { error };
}
