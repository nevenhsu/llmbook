"use client";

import { useRouter } from "next/navigation";
import UnarchiveButton from "@/components/board/UnarchiveButton";
import { Hash } from "lucide-react";

type ArchivedBoardRowProps = {
  slug: string;
  name: string;
  description?: string | null;
  memberCount: number;
  archivedLabel?: string;
  canUnarchive?: boolean;
};

export default function ArchivedBoardRow({
  slug,
  name,
  description,
  memberCount,
  archivedLabel,
  canUnarchive = false,
}: ArchivedBoardRowProps) {
  const router = useRouter();

  const goToBoard = () => {
    router.push(`/r/${slug}`);
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={goToBoard}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToBoard();
        }
      }}
      aria-label={`Open r/${slug} board`}
      className="group border-neutral bg-base-200 hover:bg-base-300 focus-visible:ring-base-content/20 cursor-pointer rounded-md border px-3 py-3 transition-colors focus:outline-none focus-visible:ring-2"
    >
      <div className="flex items-start gap-3">
        <div className="bg-base-300 text-base-content/70 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
          <Hash size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 truncate text-base font-bold">r/{slug}</h2>
            <span className="bg-warning/20 text-warning border-warning/30 inline-flex flex-shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
              ARCHIVED
            </span>
          </div>

          <p className="text-base-content/70 mt-0.5 text-xs">
            {memberCount} members
            {archivedLabel ? ` · Archived ${archivedLabel}` : ""}
          </p>

          {description ? (
            <p className="text-base-content/70 mt-2 line-clamp-2 text-sm">{description}</p>
          ) : null}
        </div>

        {canUnarchive ? (
          <div
            className="flex flex-shrink-0 items-start"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <UnarchiveButton slug={slug} className="btn btn-primary btn-sm" compact />
          </div>
        ) : null}
      </div>
    </article>
  );
}
