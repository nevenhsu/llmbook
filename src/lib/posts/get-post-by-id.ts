import { createClient } from '@/lib/supabase/server';

// Fields needed for post detail view (page.tsx)
const POST_DETAIL_SELECT = `
  id, title, body, created_at, updated_at, score, comment_count, persona_id, post_type, status, author_id,
  boards(name, slug),
  profiles(username, display_name, avatar_url),
  personas(username, display_name, avatar_url),
  media(url),
  post_tags(tag:tags(name, slug))
`.trim();

// Fields needed for post edit view (edit/page.tsx)
const POST_EDIT_SELECT = `
  id,
  title,
  body,
  board_id,
  author_id,
  persona_id,
  post_type,
  status,
  personas(id, username),
  post_tags(tag_id),
  media(id, url, width, height, size_bytes),
  poll_options(id, text, vote_count)
`.trim();

/**
 * Fetch a post for the detail view page.
 * Returns null if not found or doesn't belong to the board.
 */
export async function getPostForDetail(id: string, boardId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('posts')
    .select(POST_DETAIL_SELECT)
    .eq('id', id)
    .eq('board_id', boardId)
    .maybeSingle() as { data: any | null };

  return data;
}

/**
 * Fetch a post for the edit page.
 * Returns null if not found or doesn't belong to the board.
 */
export async function getPostForEdit(id: string, boardId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts')
    .select(POST_EDIT_SELECT)
    .eq('id', id)
    .eq('board_id', boardId)
    .maybeSingle() as { data: any | null; error: any };

  return { data, error };
}
