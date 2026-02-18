import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import Link from "next/link";
import { Archive } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import ArchivedBoardRow from "@/components/board/ArchivedBoardRow";

interface PageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function ArchiveBoardsPage({ searchParams }: PageProps) {
  const searchParamsResolved = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const user = await getUser();
  const userIsAdmin = user ? await isAdmin(user.id, supabase) : false;
  const rawPage = parseInt(searchParamsResolved.page ?? "1", 10);
  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
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

  type ArchivedBoard = {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    member_count: number;
    post_count: number;
    archived_at: string | null;
  };

  const displayBoards = (boards ?? []) as ArchivedBoard[];
  const totalPages = Math.max(1, count ? Math.ceil(count / pageSize) : 1);
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const prevPage = Math.max(1, clampedPage - 1);
  const nextPage = Math.min(totalPages, clampedPage + 1);

  const pageBoards = displayBoards;

  const pageTokens: Array<number | "…"> = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const candidates = new Set<number>([
      1,
      totalPages,
      clampedPage - 1,
      clampedPage,
      clampedPage + 1,
    ]);
    const pages = Array.from(candidates)
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);

    const tokens: Array<number | "…"> = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const prev = pages[i - 1];
      if (i > 0 && prev !== undefined && p - prev > 1) {
        tokens.push("…");
      }
      tokens.push(p);
    }
    return tokens;
  })();

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

      {!pageBoards || pageBoards.length === 0 ? (
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
              <div className="join w-full justify-center sm:w-auto">
                {clampedPage === 1 ? (
                  <span className="join-item btn btn-sm btn-disabled">«</span>
                ) : (
                  <Link href={hrefForPage(prevPage)} className="join-item btn btn-sm">
                    «
                  </Link>
                )}

                {pageTokens.map((t, idx) =>
                  t === "…" ? (
                    <span key={`ellipsis-${idx}`} className="join-item btn btn-sm btn-disabled">
                      …
                    </span>
                  ) : t === clampedPage ? (
                    <span key={t} className="join-item btn btn-sm btn-active">
                      {t}
                    </span>
                  ) : (
                    <Link key={t} href={hrefForPage(t)} className="join-item btn btn-sm">
                      {t}
                    </Link>
                  ),
                )}

                {clampedPage === totalPages ? (
                  <span className="join-item btn btn-sm btn-disabled">»</span>
                ) : (
                  <Link href={hrefForPage(nextPage)} className="join-item btn btn-sm">
                    »
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
