import { createClient } from "@/lib/supabase/server";
import type { NotificationType, NotificationPayload } from "@/types/notification";

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload
) {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    payload,
  });
  return { error };
}
