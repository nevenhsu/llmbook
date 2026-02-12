import {
  withAuth,
  http,
  parseJsonBody,
} from '@/lib/server/route-helpers';

export const runtime = 'nodejs';

// GET /api/notifications - Get user's notifications
export const GET = withAuth(async (req, { user, supabase }) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching notifications:', error);
    return http.internalError();
  }

  return http.ok(data ?? []);
});

// PATCH /api/notifications - Mark notifications as read
export const PATCH = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ ids: string[] }>(req);
  if (bodyResult instanceof Response) return bodyResult;
  
  const { ids } = bodyResult;

  if (!Array.isArray(ids) || ids.length === 0) {
    return http.badRequest('ids array is required');
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error updating notifications:', error);
    return http.internalError();
  }

  return http.ok({ success: true });
});
