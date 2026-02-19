"use client";

import { buildPaginationTokens } from "@/lib/pagination-ui";

type PaginationClientProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  joinClassName?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  size?: "sm" | "md";
};

export default function PaginationClient({
  page,
  totalPages,
  onPageChange,
  className,
  joinClassName,
  buttonClassName,
  activeButtonClassName = "btn-primary",
  size = "sm",
}: PaginationClientProps) {
  if (totalPages <= 1) return null;

  const safeTotal = Math.max(1, Math.floor(totalPages));
  const current = Math.max(1, Math.min(Math.floor(page), safeTotal));
  const prevPage = Math.max(1, current - 1);
  const nextPage = Math.min(safeTotal, current + 1);
  const tokens = buildPaginationTokens(current, safeTotal);

  const btnSize = size === "sm" ? "btn-sm" : "";
  const btnBase = `btn ${btnSize} transition-colors`.trim();
  const btnEnabledBase = `${btnBase} hover:bg-base-300 hover:underline`;
  const btnEnabled = buttonClassName ? `${btnEnabledBase} ${buttonClassName}` : btnEnabledBase;
  const btnDisabled = `${btnBase} btn-disabled bg-transparent border-transparent shadow-none hover:bg-transparent`;

  return (
    <nav aria-label="Pagination" className={className}>
      <div className={`join w-full justify-center sm:w-auto ${joinClassName || ""}`.trim()}>
        {current === 1 ? (
          <span
            className={`join-item ${btnDisabled}`}
            aria-disabled="true"
            aria-label="Previous page"
          >
            «
          </span>
        ) : (
          <button
            type="button"
            className={`join-item ${btnEnabled}`}
            onClick={() => onPageChange(prevPage)}
            aria-label="Previous page"
          >
            «
          </button>
        )}

        {tokens.map((t, idx) =>
          t === "ellipsis" ? (
            <span
              key={`ellipsis-${idx}`}
              className={`join-item ${btnDisabled}`}
              aria-disabled="true"
            >
              ...
            </span>
          ) : t === current ? (
            <span
              key={t}
              className={`join-item ${btnBase} btn-active ${activeButtonClassName || ""}`.trim()}
              aria-current="page"
            >
              {t}
            </span>
          ) : (
            <button
              key={t}
              type="button"
              className={`join-item ${btnEnabled}`}
              onClick={() => onPageChange(t)}
              aria-label={`Page ${t}`}
            >
              {t}
            </button>
          ),
        )}

        {current === safeTotal ? (
          <span className={`join-item ${btnDisabled}`} aria-disabled="true" aria-label="Next page">
            »
          </span>
        ) : (
          <button
            type="button"
            className={`join-item ${btnEnabled}`}
            onClick={() => onPageChange(nextPage)}
            aria-label="Next page"
          >
            »
          </button>
        )}
      </div>
    </nav>
  );
}
