import Link from "next/link";
import { notFound } from "next/navigation";
import { Hash, Users } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { DEFAULT_BOARD_LIST_PER_PAGE, parsePageParam } from "@/lib/board-pagination";
import BackToBoard from "@/components/board/BackToBoard";

interface MemberItem {
  user_id: string;
  joined_at: string | null;
  is_moderator: boolean;
  profiles: {
    display_name?: string;
    avatar_url?: string | null;
  } | null;
}

function buildPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }).map((_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis");
  }

  items.push(totalPages);
  return items;
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BoardMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const page = parsePageParam(resolvedSearchParams.page);
  const offset = (page - 1) * DEFAULT_BOARD_LIST_PER_PAGE;

  const board = await getBoardBySlug(slug);

  if (!board) {
    notFound();
  }

  const [{ data: membersData, count }, { data: moderators }] = await Promise.all([
    supabase
      .from("board_members")
      .select(
        `
          user_id,
          joined_at,
          profiles:user_id (
            display_name,
            avatar_url
          )
        `,
        { count: "exact" },
      )
      .eq("board_id", board.id)
      .order("joined_at", { ascending: false })
      .range(offset, offset + DEFAULT_BOARD_LIST_PER_PAGE - 1),
    supabase.from("board_moderators").select("user_id").eq("board_id", board.id),
  ]);

  const moderatorIds = new Set((moderators || []).map((mod: { user_id: string }) => mod.user_id));
  const members: MemberItem[] = (membersData || []).map((member: any) => ({
    user_id: member.user_id,
    joined_at: member.joined_at ?? null,
    profiles: member.profiles,
    is_moderator: moderatorIds.has(member.user_id),
  }));
  const totalMembers = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalMembers / DEFAULT_BOARD_LIST_PER_PAGE));
  const paginationItems = buildPaginationItems(page, totalPages);

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
                <Users size={14} />
                {totalMembers.toLocaleString()} members
              </p>
            </div>
          </div>
          <p className="text-sm opacity-75">Public member directory.</p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="alert mx-4 sm:mx-0">
          <span>No members found.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-0">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="card bg-base-100 border-neutral flex flex-row items-center gap-3 border p-3"
            >
              <Avatar
                src={member.profiles?.avatar_url || undefined}
                fallbackSeed={member.profiles?.display_name || member.user_id}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.profiles?.display_name || "Unknown"}</p>
                <p className="text-xs opacity-70">Joined: {formatDate(member.joined_at)}</p>
              </div>
              {member.is_moderator ? (
                <span className="badge badge-ghost badge-xs">moderator</span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="join w-full px-4 sm:w-auto sm:px-0">
          <Link
            href={`/r/${board.slug}/member?page=${Math.max(1, page - 1)}`}
            className={`join-item btn btn-sm flex-1 sm:flex-none ${page === 1 ? "btn-disabled" : ""}`}
          >
            «
          </Link>
          {paginationItems.map((item, index) =>
            item === "ellipsis" ? (
              <button key={`ellipsis-${index}`} className="join-item btn btn-sm btn-disabled">
                ...
              </button>
            ) : (
              <Link
                key={`page-${item}`}
                href={`/r/${board.slug}/member?page=${item}`}
                className={`join-item btn btn-sm ${item === page ? "btn-active" : ""}`}
              >
                {item}
              </Link>
            ),
          )}
          <Link
            href={`/r/${board.slug}/member?page=${Math.min(totalPages, page + 1)}`}
            className={`join-item btn btn-sm flex-1 sm:flex-none ${page === totalPages ? "btn-disabled" : ""}`}
          >
            »
          </Link>
        </div>
      ) : null}
    </div>
  );
}
