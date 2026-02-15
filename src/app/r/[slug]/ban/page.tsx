import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Hash, ShieldBan } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import { isAdmin } from '@/lib/admin';
import { isBoardModerator } from '@/lib/board-permissions';
import { getBoardBySlug } from '@/lib/boards/get-board-by-slug';
import { BanActions } from '@/components/board/BanActions';
import { DEFAULT_BOARD_LIST_PER_PAGE, parsePageParam } from '@/lib/board-pagination';

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
      isBoardModerator(board.id, user.id),
    ]);

    canEditBans = userIsAdmin || userIsModerator;
  }

  const { data: bansData, count } = await supabase
    .from('board_bans')
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
      { count: 'exact' }
    )
    .eq('board_id', board.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + DEFAULT_BOARD_LIST_PER_PAGE - 1);

  const bans = (bansData || []) as PaginatedBansResponse['items'];
  const totalBans = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalBans / DEFAULT_BOARD_LIST_PER_PAGE));
  const placeholderCount = Math.min(DEFAULT_BOARD_LIST_PER_PAGE, Math.max(6, bans.length || 0));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="text-sm px-4 sm:px-0">
          <Link href={`/r/${board.slug}`} className="link link-hover text-base-content/80">
            Back to Board
          </Link>
        </div>
        <div className="card bg-base-100 rounded-none sm:rounded-box p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Hash size={24} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">r/{board.slug}</h1>
              <p className="text-sm opacity-75 inline-flex items-center gap-1">
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
          <div key={`ban-placeholder-${index}`} className="card bg-base-100 p-3 flex flex-row items-center gap-3 border border-neutral animate-pulse">
            <div className="w-8 h-8 rounded-full bg-base-300" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 w-32 bg-base-300 rounded" />
              <div className="h-3 w-44 bg-base-300 rounded" />
              <div className="h-3 w-36 bg-base-300 rounded" />
              <div className="h-3 w-28 bg-base-300 rounded" />
            </div>
            {canEditBans ? (
              <div className="w-12 h-6 bg-base-300 rounded" />
            ) : null}
          </div>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="join w-full sm:w-auto px-4 sm:px-0">
          <Link
            href={`/r/${board.slug}/ban?page=${Math.max(1, page - 1)}`}
            className={`join-item btn btn-sm flex-1 sm:flex-none ${page === 1 ? 'btn-disabled' : ''}`}
          >
            «
          </Link>
          <button className="join-item btn btn-sm flex-1 sm:flex-none btn-disabled">
            Page {page} of {totalPages}
          </button>
          <Link
            href={`/r/${board.slug}/ban?page=${Math.min(totalPages, page + 1)}`}
            className={`join-item btn btn-sm flex-1 sm:flex-none ${page === totalPages ? 'btn-disabled' : ''}`}
          >
            »
          </Link>
        </div>
      ) : null}
    </div>
  );
}
