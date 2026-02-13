import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type BoardBySlug = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  member_count: number;
  post_count: number;
  created_at: string;
  rules: Array<{ title: string; description: string }> | null;
  is_archived: boolean;
};

export const getBoardBySlug = cache(async (slug: string): Promise<BoardBySlug | null> => {
  const supabase = await createClient(cookies());
  const { data: board } = await supabase
    .from("boards")
    .select(
      "id, name, slug, description, banner_url, member_count, post_count, created_at, rules, is_archived",
    )
    .eq("slug", slug)
    .maybeSingle();

  return board;
});
