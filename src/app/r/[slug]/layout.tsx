import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { notFound } from "next/navigation";
import BoardInfoCard from "@/components/board/BoardInfoCard";
import { BoardProvider } from "@/contexts/BoardContext";
import { isAdmin } from "@/lib/admin";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { transformBoardToFormat } from "@/lib/posts/query-builder";

type BoardInfoCardModerator = NonNullable<
  Parameters<typeof BoardInfoCard>[0]["moderators"]
>[number];

type ModeratorRowProfile = {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
};

type ModeratorRow = {
  user_id: string;
  role: string;
  profiles: ModeratorRowProfile | ModeratorRowProfile[] | null;
};

function isModeratorRow(value: unknown): value is ModeratorRow {
  if (!value || typeof value !== "object") return false;
  const row = value as { user_id?: unknown; role?: unknown };
  return typeof row.user_id === "string" && typeof row.role === "string";
}

function normalizeModerators(rows: unknown[]): BoardInfoCardModerator[] {
  return rows.filter(isModeratorRow).map((mod) => {
    const profile = Array.isArray(mod.profiles) ? mod.profiles[0] : mod.profiles;
    return {
      user_id: mod.user_id,
      role: mod.role,
      profiles: {
        display_name: profile?.display_name ?? "Unknown",
        avatar_url: profile?.avatar_url ?? null,
        username: profile?.username ?? null,
      },
    };
  });
}

interface BoardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function BoardLayout({ children, params }: BoardLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const user = await getUser();

  const board = await getBoardBySlug(slug);

  if (!board) {
    notFound();
  }

  const formattedBoard = transformBoardToFormat(board);

  // Check permissions
  let userIsAdmin = false;
  let isModerator = false;
  let canModerate = false;

  if (user) {
    userIsAdmin = await isAdmin(user.id);
  }

  // Get membership status and moderators in parallel
  let isJoined = false;
  let moderators: BoardInfoCardModerator[] = [];
  let canOpenSettings = false;

  if (user) {
    const [membershipResult, moderatorsResult] = await Promise.all([
      supabase
        .from("board_members")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("board_id", board.id)
        .maybeSingle(),
      supabase
        .from("board_moderators")
        .select(
          `
          user_id,
          role,
          profiles:user_id (
            display_name,
            avatar_url,
            username
          )
        `,
        )
        .eq("board_id", board.id)
        .order("created_at", { ascending: true }),
    ]);

    isJoined = !!membershipResult.data;
    moderators = normalizeModerators(
      Array.isArray(moderatorsResult.data) ? moderatorsResult.data : [],
    );

    isModerator = moderators.some((mod) => mod.user_id === user.id);
    canOpenSettings = userIsAdmin || isModerator;
    canModerate = userIsAdmin || isModerator;
  } else {
    // If no user, still fetch moderators
    const { data: moderatorsResult } = await supabase
      .from("board_moderators")
      .select(
        `
        user_id,
        role,
        profiles:user_id (
          display_name,
          avatar_url,
          username
        )
      `,
      )
      .eq("board_id", board.id)
      .order("created_at", { ascending: true });

    moderators = normalizeModerators(Array.isArray(moderatorsResult) ? moderatorsResult : []);
  }

  return (
    <BoardProvider
      value={{
        boardId: board.id,
        boardSlug: board.slug,
        isModerator,
        canModerate,
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Main content area */}
        <div className="min-w-0 flex-1">{children}</div>

        {/* Desktop Sidebar - shared across all board pages */}
        <aside className="hidden w-[312px] lg:block">
          <BoardInfoCard
            board={formattedBoard}
            isMember={isJoined}
            canOpenSettings={canOpenSettings}
            isAdmin={userIsAdmin}
            rules={board.rules || []}
            moderators={moderators}
          />
        </aside>
      </div>
    </BoardProvider>
  );
}
