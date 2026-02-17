import { createClient } from "@/lib/supabase/server";

export interface UserBoard {
  id: string;
  name: string;
  slug: string;
}

/**
 * Fetch the boards a user has joined, sorted by most recently joined.
 * Used for board selectors in post create/edit forms.
 */
export async function getUserJoinedBoards(userId: string, limit = 10): Promise<UserBoard[]> {
  const supabase = await createClient();

  const { data: joinedBoards } = await supabase
    .from("board_members")
    .select("boards(id,name,slug)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(limit);

  return (
    joinedBoards
      ?.map((jb) => {
        const board = jb.boards as any;
        if (!board || typeof board !== "object" || Array.isArray(board)) return null;
        return {
          id: board.id as string,
          name: board.name as string,
          slug: board.slug as string,
        };
      })
      .filter((b): b is UserBoard => b !== null) ?? []
  );
}
