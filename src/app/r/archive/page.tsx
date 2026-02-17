import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import Link from "next/link";
import { Archive } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import Avatar from "@/components/ui/Avatar";
import UnarchiveButton from "@/components/board/UnarchiveButton";

export default async function ArchiveBoardsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = await createClient();
  const user = await getUser();
  const userIsAdmin = user ? await isAdmin(user.id, supabase) : false;
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const { data: boards, count } = await supabase
    .from("boards")
    .select("id, slug, name, description, member_count, post_count, archived_at", {
      count: "exact",
    })
    .eq("is_archived", true)
    .order("archived_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const totalPages = count ? Math.ceil(count / pageSize) : 1;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      "day",
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 sm:pb-6">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">Archived Boards</h1>

      {!boards || boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <Archive size={48} className="text-base-content/60 mb-4" />
          <p className="text-base-content/70">No archived boards</p>
        </div>
      ) : (
        <>
          <div className="divide-neutral divide-y">
            {boards.map((board) => (
              <div key={board.id} className="px-4 py-4 sm:px-0">
                <div className="flex items-center gap-3">
                  <Avatar fallbackSeed={board.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium">r/{board.slug}</h2>
                    <p className="text-base-content/70 text-xs">
                      {board.member_count} members · Archived{" "}
                      {board.archived_at ? formatDate(board.archived_at) : ""}
                    </p>
                  </div>
                </div>
                {board.description && (
                  <p className="text-base-content/70 mt-2 line-clamp-2 text-sm">
                    {board.description}
                  </p>
                )}
                <Link href={`/r/${board.slug}`} className="btn btn-outline btn-sm mt-3 w-full">
                  View (Read-only)
                </Link>
                {userIsAdmin && (
                  <UnarchiveButton
                    slug={board.slug}
                    className="btn btn-primary btn-sm mt-2 w-full"
                    compact
                  />
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-base-200 border-neutral fixed right-0 bottom-0 left-0 mt-6 border-t p-3 sm:relative sm:border-0 sm:p-0">
              <div className="join w-full sm:w-auto">
                <Link
                  href={`/r/archive?page=${Math.max(1, page - 1)}`}
                  className={`join-item btn btn-sm flex-1 sm:flex-none ${
                    page === 1 ? "btn-disabled" : ""
                  }`}
                >
                  «
                </Link>
                <button className="join-item btn btn-sm btn-disabled flex-1 sm:flex-none">
                  Page {page} of {totalPages}
                </button>
                <Link
                  href={`/r/archive?page=${Math.min(totalPages, page + 1)}`}
                  className={`join-item btn btn-sm flex-1 sm:flex-none ${
                    page === totalPages ? "btn-disabled" : ""
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
