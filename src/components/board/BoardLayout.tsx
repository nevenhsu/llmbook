"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Users, Settings, Hash, ShieldBan } from "lucide-react";
import { MemberCountProvider, useMemberCount } from "./BoardMemberCount";
import JoinButton from "./JoinButton";
import ResponsiveMenu from "@/components/ui/ResponsiveMenu";
import toast from "react-hot-toast";

interface BoardLayoutProps {
  children: ReactNode;
  board: {
    slug: string;
    name: string;
    description?: string | null;
    member_count: number;
    is_archived: boolean;
    rules?: any[];
  };
  slug: string;
  isJoined: boolean;
  canManage?: boolean;
  isAdmin?: boolean;
}

export default function BoardLayout({
  children,
  board,
  slug,
  isJoined,
  canManage = false,
  isAdmin = false,
}: BoardLayoutProps) {
  return (
    <MemberCountProvider initialCount={board.member_count}>
      <MobileBoardHeader
        board={board}
        slug={slug}
        isJoined={isJoined}
        canManage={canManage}
        isAdmin={isAdmin}
      />
      {children}
    </MemberCountProvider>
  );
}

function MobileBoardHeader({
  board,
  slug,
  isJoined,
  canManage,
  isAdmin,
}: {
  board: BoardLayoutProps["board"];
  slug: string;
  isJoined: boolean;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { setMemberCount } = useMemberCount();
  const [isArchived, setIsArchived] = useState(board.is_archived);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    setIsArchived(board.is_archived);
  }, [board.is_archived]);

  const handleArchiveToggle = async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/boards/${slug}`, {
        method: isArchived ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: isArchived ? JSON.stringify({ is_archived: false }) : undefined,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setIsArchived(!isArchived);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(isArchived ? "Failed to unarchive board" : "Failed to archive board");
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="lg:hidden">
      {/* Main Board Header */}
      <div className="border-neutral mb-4 border-b px-4 py-3">
        <div className="mb-3 flex items-start gap-3">
          <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
            <Hash size={24} className="text-primary" />
          </div>
          <MemberCountDisplay slug={board.slug} />

          {/* Responsive Menu (desktop dropdown + mobile drawer) */}
          <ResponsiveMenu
            trigger={<MoreVertical size={16} />}
            title="Board menu"
            ariaLabel="Board menu"
          >
            <li>
              <Link href={`/r/${slug}/member`}>
                <Users size={14} className="hidden md:inline" />
                <Users size={20} className="md:hidden" />
                Members
              </Link>
            </li>
            <li>
              <Link href={`/r/${slug}/ban`}>
                <ShieldBan size={14} className="hidden md:inline" />
                <ShieldBan size={20} className="md:hidden" />
                Bans
              </Link>
            </li>
          </ResponsiveMenu>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {!isArchived && (
            <JoinButton
              slug={slug}
              isJoined={isJoined}
              refreshOnSuccess={false}
              onMemberCountChange={setMemberCount}
            />
          )}

          {canManage && (
            <Link
              href={`/r/${slug}/settings`}
              className="btn btn-sm btn-outline text-base-content rounded-full"
            >
              <Settings size={14} />
              Settings
            </Link>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={archiveLoading}
              className={`btn btn-sm rounded-full ${isArchived ? "btn-success" : "btn-warning text-warning-content"}`}
            >
              {archiveLoading ? "..." : isArchived ? "Unarchive" : "Archive"}
            </button>
          )}
        </div>

        {board.description && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">About this community</summary>
            <p className="text-base-content/70 mt-2 text-sm">{board.description}</p>
          </details>
        )}

        {board.rules && board.rules.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">
              Community Rules ({board.rules.length})
            </summary>
            <ol className="text-base-content/70 mt-2 list-inside list-decimal space-y-2 text-sm">
              {board.rules.map((rule: any, idx: number) => (
                <li key={idx} className="pl-1">
                  <span className="font-medium">{rule.title}</span>
                  {rule.description && (
                    <p className="text-base-content/60 mt-0.5 ml-5 text-xs">{rule.description}</p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}

function MemberCountDisplay({ slug }: { slug: string }) {
  const { memberCount } = useMemberCount();

  return (
    <div className="min-w-0 flex-1">
      <h1 className="text-lg font-bold">r/{slug}</h1>
      <p className="text-base-content/70 text-xs">{memberCount} members</p>
    </div>
  );
}
