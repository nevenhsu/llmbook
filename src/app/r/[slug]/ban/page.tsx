import { notFound } from "next/navigation";
import { Hash, ShieldBan } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { isBoardModerator } from "@/lib/board-permissions";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { BanActions } from "@/components/board/BanActions";
import { DEFAULT_BOARD_LIST_PER_PAGE, parsePageParam } from "@/lib/board-pagination";
import BackToBoard from "@/components/board/BackToBoard";
import Pagination from "@/components/ui/Pagination";

interface BanItem {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  user?: {
    display_name?: string;
    avatar_url?: string | null;
  };
  banned_by_user?: {
    display_name?: string;
  };
}

interface PaginatedBansResponse {
  items: BanItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export default async function BoardBanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const user = await getUser();

  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const page = parsePageParam(resolvedSearchParams.page);
  const offset = (page - 1) * DEFAULT_BOARD_LIST_PER_PAGE;

  const board = await getBoardBySlug(slug);

  if (!board) {
    notFound();
  }

  let canEditBans = false;

  if (user) {
    const [userIsAdmin, userIsModerator] = await Promise.all([
      isAdmin(user.id, supabase),
      isBoardModerator(board.id, user.id, supabase),
    ]);

    canEditBans = userIsAdmin || userIsModerator;
  }

  const { data: bansData, count } = await supabase
    .from("board_bans")
    .select(
      `
        id,
        user_id,
        reason,
        expires_at,
        created_at,
        user:user_id (
          display_name,
          avatar_url
        ),
        banned_by_user:banned_by (
          display_name
        )
      `,
      { count: "exact" },
    )
    .eq("board_id", board.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + DEFAULT_BOARD_LIST_PER_PAGE - 1);

  const bans = (bansData || []) as PaginatedBansResponse["items"];
  const totalBans = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalBans / DEFAULT_BOARD_LIST_PER_PAGE));
  const placeholderCount = Math.min(DEFAULT_BOARD_LIST_PER_PAGE, Math.max(6, bans.length || 0));
  const hrefForPage = (p: number) => `/r/${board.slug}/ban?page=${p}`;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="px-4 text-sm sm:px-0">
          <BackToBoard slug={board.slug} />
        </div>
        <div className="card bg-base-100 sm:rounded-box space-y-3 rounded-none p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
              <Hash size={24} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">r/{board.slug}</h1>
              <p className="inline-flex items-center gap-1 text-sm opacity-75">
                <ShieldBan size={14} />
                {totalBans.toLocaleString()} bans
              </p>
            </div>
          </div>
          <p className="text-sm opacity-75">Public ban directory for this community.</p>
        </div>
      </div>

      <BanActions boardSlug={board.slug} canEditBans={canEditBans} />

      <div className="space-y-2 px-4 sm:px-0">
        {Array.from({ length: placeholderCount }).map((_, index) => (
          <div
            key={`ban-placeholder-${index}`}
            className="card bg-base-100 border-neutral flex animate-pulse flex-row items-center gap-3 border p-3"
          >
            <div className="bg-base-300 h-8 w-8 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="bg-base-300 h-4 w-32 rounded" />
              <div className="bg-base-300 h-3 w-44 rounded" />
              <div className="bg-base-300 h-3 w-36 rounded" />
              <div className="bg-base-300 h-3 w-28 rounded" />
            </div>
            {canEditBans ? <div className="bg-base-300 h-6 w-12 rounded" /> : null}
          </div>
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={hrefForPage}
        className="w-full px-4 sm:w-auto sm:px-0"
      />
    </div>
  );
}
