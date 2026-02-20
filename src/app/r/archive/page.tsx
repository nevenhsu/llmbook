import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { Archive } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import ArchivedBoardRow from "@/components/board/ArchivedBoardRow";
import Pagination from "@/components/ui/Pagination";
import {
  DEFAULT_BOARD_LIST_PER_PAGE,
  getOffset,
  getTotalPages,
  parsePageParam,
} from "@/lib/board-pagination";

interface PageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function ArchiveBoardsPage({ searchParams }: PageProps) {
  const searchParamsResolved = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const user = await getUser();
  const userIsAdmin = user ? await isAdmin(user.id) : false;
  const page = parsePageParam(searchParamsResolved.page);
  const pageSize = DEFAULT_BOARD_LIST_PER_PAGE;
  const offset = getOffset(page, pageSize);

  const {
    data: boards,
    count,
    error,
  } = await supabase
    .from("boards")
    .select("id, slug, name, description, member_count, post_count, archived_at", {
      count: "exact",
    })
    .eq("is_archived", true)
    .order("archived_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  type ArchivedBoard = {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    member_count: number;
    post_count: number;
    archived_at: string | null;
  };

  const pageBoards = ((error ? [] : boards) ?? []) as ArchivedBoard[];
  const totalItems = typeof count === "number" ? count : pageBoards.length;
  const totalPages = getTotalPages(totalItems, pageSize);

  const hrefForPage = (p: number) => `/r/archive?page=${p}`;

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

      {pageBoards.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <Archive size={48} className="text-base-content/60 mb-4" />
          <p className="text-base-content/70">No archived boards</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pageBoards.map((board) => (
              <ArchivedBoardRow
                key={board.id}
                slug={board.slug}
                name={board.name}
                description={board.description}
                memberCount={board.member_count}
                archivedLabel={board.archived_at ? formatDate(board.archived_at) : ""}
                canUnarchive={userIsAdmin}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-base-200 border-neutral fixed right-0 bottom-0 left-0 mt-6 border-t p-3 sm:relative sm:border-0 sm:p-0">
              <Pagination page={page} totalPages={totalPages} hrefForPage={hrefForPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
