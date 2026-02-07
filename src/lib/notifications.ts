import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function createNotification(userId: string, type: string, payload: any) {
  const supabase = await createClient(cookies());
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      payload,
    });
  return { error };
}
