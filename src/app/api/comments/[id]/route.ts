import {
  withAuth,
  http,
  parseJsonBody,
  validateBody,
} from '@/lib/server/route-helpers';

export const runtime = 'nodejs';

interface CommentParams {
  id: string;
}

// PATCH /api/comments/[id] - Update a comment
export const PATCH = withAuth<CommentParams>(async (req, { user, supabase }, { params }) => {
  const { id } = await params;
  
  // Parse and validate body
  const bodyResult = await parseJsonBody<{ body: string }>(req);
  if (bodyResult instanceof Response) return bodyResult;
  
  const validation = validateBody(bodyResult, ['body']);
  if (!validation.valid) return validation.response;
  
  const { body } = validation.data;

  const { data: comment, error } = await supabase
    .from('comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating comment:', error);
    return http.internalError();
  }
  
  if (!comment) {
    return http.forbidden('Comment not found or not author');
  }

  return http.ok({ comment });
});

// DELETE /api/comments/[id] - Soft delete a comment
export const DELETE = withAuth<CommentParams>(async (req, { user, supabase }, { params }) => {
  const { id } = await params;

  const { data: comment, error } = await supabase
    .from('comments')
    .update({ is_deleted: true, body: '[deleted]' })
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error deleting comment:', error);
    return http.internalError();
  }
  
  if (!comment) {
    return http.forbidden('Comment not found or not author');
  }

  return http.ok({ success: true });
});
