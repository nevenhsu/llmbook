import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { isAdmin } from '@/lib/admin';
import Avatar from '@/components/ui/Avatar';
import UnarchiveButton from '@/components/board/UnarchiveButton';

export default async function ArchiveBoardsPage({
  searchParams
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userIsAdmin = user ? await isAdmin(user.id, supabase) : false;
  const page = parseInt(searchParams.page || '1', 10);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const { data: boards, count } = await supabase
    .from('boards')
    .select('id, slug, name, description, icon_url, member_count, post_count, archived_at', { count: 'exact' })
    .eq('is_archived', true)
    .order('archived_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const totalPages = count ? Math.ceil(count / pageSize) : 1;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">Archived Boards</h1>

      {!boards || boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <Archive size={48} className="text-[#818384] mb-4" />
          <p className="text-[#818384]">No archived boards</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-neutral">
            {boards.map((board) => (
              <div key={board.id} className="py-4 px-4 sm:px-0">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={board.icon_url || undefined}
                    fallbackSeed={board.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium truncate">r/{board.slug}</h2>
                    <p className="text-xs text-[#818384]">
                      {board.member_count} members · Archived {board.archived_at ? formatDate(board.archived_at) : ''}
                    </p>
                  </div>
                </div>
                {board.description && (
                  <p className="text-sm text-[#818384] mt-2 line-clamp-2">
                    {board.description}
                  </p>
                )}
                <Link
                  href={`/r/${board.slug}`}
                  className="btn btn-outline btn-sm w-full mt-3"
                >
                  View (Read-only)
                </Link>
                {userIsAdmin && (
                  <UnarchiveButton
                    slug={board.slug}
                    className="btn btn-primary btn-sm w-full mt-2"
                    compact
                  />
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="fixed bottom-0 left-0 right-0 sm:relative bg-base-200 border-t border-neutral p-3 sm:p-0 sm:border-0 mt-6">
              <div className="join w-full sm:w-auto">
                <Link
                  href={`/r/archive?page=${Math.max(1, page - 1)}`}
                  className={`join-item btn btn-sm flex-1 sm:flex-none ${
                    page === 1 ? 'btn-disabled' : ''
                  }`}
                >
                  «
                </Link>
                <button className="join-item btn btn-sm flex-1 sm:flex-none btn-disabled">
                  Page {page} of {totalPages}
                </button>
                <Link
                  href={`/r/archive?page=${Math.min(totalPages, page + 1)}`}
                  className={`join-item btn btn-sm flex-1 sm:flex-none ${
                    page === totalPages ? 'btn-disabled' : ''
                  }`}
                >
                  »
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
