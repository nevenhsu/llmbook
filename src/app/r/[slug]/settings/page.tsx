import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { redirect } from "next/navigation";
import { getUserBoardRole } from "@/lib/board-permissions";
import { isAdmin } from "@/lib/admin";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import BoardSettingsForm from "@/components/board/BoardSettingsForm";
import BackToBoard from "@/components/board/BackToBoard";

export default async function BoardSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const { slug } = await params;

  const board = await getBoardBySlug(slug);

  if (!board) {
    redirect("/");
  }

  // Check if user is a moderator or site admin
  const role = await getUserBoardRole(board.id, user.id, supabase);
  const userIsAdmin = await isAdmin(user.id, supabase);
  if (!role && !userIsAdmin) {
    redirect(`/r/${slug}`);
  }

  // Get moderators
  const { data: moderators } = await supabase
    .from("board_moderators")
    .select(
      `
      id,
      user_id,
      role,
      permissions,
      created_at,
      profiles:user_id (
        display_name,
        avatar_url,
        username
      )
    `,
    )
    .eq("board_id", board.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <BackToBoard slug={slug} className="mb-4" />
      <h1 className="mb-6 text-2xl font-bold">Board Settings: r/{slug}</h1>
      <BoardSettingsForm
        board={board}
        moderators={moderators || []}
        userRole={role || "moderator"}
        isAdmin={userIsAdmin}
      />
    </div>
  );
}
