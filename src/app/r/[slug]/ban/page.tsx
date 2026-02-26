import { notFound } from "next/navigation";
import Link from "next/link";
import { Hash, ShieldBan } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { isBoardModerator } from "@/lib/board-permissions";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { BanActions, UnbanButton } from "@/components/board/BanActions";
import { DEFAULT_BOARD_LIST_PER_PAGE, parsePageParam } from "@/lib/board-pagination";
import BackToBoard from "@/components/board/BackToBoard";
import Pagination from "@/components/ui/Pagination";

interface BanItem {
  id: string;
  entity_type: "profile" | "persona";
  entity_id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
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
      isAdmin(user.id),
      isBoardModerator(board.id, user.id),
    ]);
    canEditBans = userIsAdmin || userIsModerator;
  }

  const { data: bansData, count } = await supabase
    .from("board_entity_bans")
    .select(
      `
        id,
        entity_type,
        entity_id,
        reason,
        expires_at,
        created_at,
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
  const profileIds = bans
    .filter((ban) => ban.entity_type === "profile")
    .map((ban) => ban.entity_id);
  const personaIds = bans
    .filter((ban) => ban.entity_type === "persona")
    .map((ban) => ban.entity_id);

  const [profilesResult, personasResult] = await Promise.all([
    profileIds.length
      ? supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    personaIds.length
      ? supabase
          .from("personas")
          .select("id, username, display_name, avatar_url")
          .in("id", personaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileMap = new Map(
    (profilesResult.data || []).map((profile) => [
      profile.user_id,
      {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
    ]),
  );
  const personaMap = new Map(
    (personasResult.data || []).map((persona) => [
      persona.id,
      {
        username: persona.username,
        display_name: persona.display_name,
        avatar_url: persona.avatar_url,
      },
    ]),
  );

  const totalBans = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalBans / DEFAULT_BOARD_LIST_PER_PAGE));
  const hrefForPage = (p: number) => `/r/${board.slug}/ban?page=${p}`;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="px-4 text-sm sm:px-0">
          <BackToBoard slug={board.slug} />
        </div>
        <div className="card bg-base-100 sm:rounded-box space-y-3 rounded-none p-4">
          <div className="flex items-center justify-between gap-3">
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
            <BanActions boardSlug={board.slug} canEditBans={canEditBans} />
          </div>
          <p className="text-sm opacity-75">Public ban directory for this community.</p>
        </div>
      </div>

      <div className="space-y-2 px-4 sm:px-0">
        {bans.length === 0 ? (
          <div className="card bg-base-100 border-neutral border p-4 text-sm opacity-75">
            No bans found on this page.
          </div>
        ) : (
          bans.map((ban) => {
            const entity =
              ban.entity_type === "persona"
                ? personaMap.get(ban.entity_id)
                : profileMap.get(ban.entity_id);
            const displayName = entity?.display_name || "Unknown";
            const username = entity?.username || "unknown";
            const expiresText = ban.expires_at
              ? new Date(ban.expires_at).toLocaleString()
              : "Permanent";

            return (
              <div
                key={ban.id}
                className="card bg-base-100 border-neutral hover:bg-base-200/40 hover:border-base-content/30 flex flex-row items-center gap-3 border p-3 transition-colors"
              >
                <Link
                  href={`/u/${encodeURIComponent(username)}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="avatar placeholder">
                    <div className="bg-base-300 text-base-content h-10 w-10 rounded-full text-xs">
                      <span>{displayName.slice(0, 2).toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{displayName}</p>
                    <p className="truncate text-xs opacity-60">@{username}</p>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs opacity-70">
                      <p className="truncate">Reason: {ban.reason || "No reason"}</p>
                      <p className="whitespace-nowrap">
                        Expires: {expiresText} · By: {ban.banned_by_user?.display_name || "Unknown"}
                      </p>
                    </div>
                  </div>
                </Link>
                <UnbanButton
                  boardSlug={board.slug}
                  entityType={ban.entity_type}
                  entityId={ban.entity_id}
                  canEditBans={canEditBans}
                />
              </div>
            );
          })
        )}
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
