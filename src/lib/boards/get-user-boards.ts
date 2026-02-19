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

  type JoinedBoard = { id: string; name: string; slug: string };
  type JoinedBoardRow = { boards: JoinedBoard | JoinedBoard[] | null };

  return (
    joinedBoards
      ?.map((jb) => {
        const row = jb as unknown as JoinedBoardRow;
        const board = Array.isArray(row.boards) ? row.boards[0] : row.boards;
        if (!board) return null;
        if (
          typeof board.id !== "string" ||
          typeof board.name !== "string" ||
          typeof board.slug !== "string"
        ) {
          return null;
        }
        return { id: board.id, name: board.name, slug: board.slug };
      })
      .filter((b): b is UserBoard => b !== null) ?? []
  );
}
