import type { SupabaseClient } from "@supabase/supabase-js";

export type GetBoardIdBySlugResult =
  | { boardId: string }
  | { error: "not_found" }
  | { error: "query_failed" };

export async function getBoardIdBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<GetBoardIdBySlugResult> {
  const { data, error } = await supabase.from("boards").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    return { error: "query_failed" };
  }

  if (!data) {
    return { error: "not_found" };
  }

  return { boardId: (data as { id: string }).id };
}
