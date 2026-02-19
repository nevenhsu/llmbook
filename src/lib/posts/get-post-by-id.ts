import { createClient } from "@/lib/supabase/server";
import type { RawPost } from "@/lib/posts/query-builder";

// Fields needed for post detail view (page.tsx)
const POST_DETAIL_SELECT = `
  id, title, body, created_at, updated_at, score, comment_count, persona_id, post_type, status, author_id, expires_at,
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

export type RawPostForDetail = RawPost & {
  body: string;
  post_type: string;
  expires_at?: string | null;
};

export type RawPostForEdit = {
  id: string;
  title: string;
  body: string | null;
  board_id: string;
  author_id: string;
  persona_id: string | null;
  post_type: string;
  status: string;
  personas:
    | { id: string; username: string | null }
    | { id: string; username: string | null }[]
    | null;
  post_tags: { tag_id: string }[] | null;
  media:
    | {
        id: string;
        url: string;
        width: number | null;
        height: number | null;
        size_bytes: number | null;
      }[]
    | null;
  poll_options: { id: string; text: string; vote_count: number }[] | null;
};

/**
 * Fetch a post for the detail view page.
 * Returns null if not found or doesn't belong to the board.
 */
export async function getPostForDetail(id: string, boardId: string) {
  const supabase = await createClient();
  const { data } = (await supabase
    .from("posts")
    .select(POST_DETAIL_SELECT)
    .eq("id", id)
    .eq("board_id", boardId)
    .maybeSingle()) as { data: RawPostForDetail | null };

  return data;
}

/**
 * Fetch a post for the edit page.
 * Returns null if not found or doesn't belong to the board.
 */
export async function getPostForEdit(id: string, boardId: string) {
  const supabase = await createClient();
  const { data, error } = (await supabase
    .from("posts")
    .select(POST_EDIT_SELECT)
    .eq("id", id)
    .eq("board_id", boardId)
    .maybeSingle()) as { data: RawPostForEdit | null; error: unknown };

  return { data, error };
}
