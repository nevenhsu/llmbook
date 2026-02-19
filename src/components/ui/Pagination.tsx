import Link from "next/link";
import { buildPaginationTokens } from "@/lib/pagination-ui";

type PaginationProps = {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  className?: string;
  joinClassName?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  size?: "sm" | "md";
};

export default function Pagination({
  page,
  totalPages,
  hrefForPage,
  className,
  joinClassName,
  buttonClassName,
  activeButtonClassName = "btn-primary",
  size = "sm",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const safeTotal = Math.max(1, Math.floor(totalPages));
  const current = Math.max(1, Math.min(Math.floor(page), safeTotal));
  const prevPage = Math.max(1, current - 1);
  const nextPage = Math.min(safeTotal, current + 1);
  const tokens = buildPaginationTokens(current, safeTotal);

  const btnSize = size === "sm" ? "btn-sm" : "";
  const btnBase = `btn ${btnSize} transition-colors`.trim();
  const btnEnabledBase = `${btnBase} hover:bg-base-300`;
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
          <Link
            className={`join-item ${btnEnabled}`}
            href={hrefForPage(prevPage)}
            aria-label="Previous page"
          >
            «
          </Link>
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
            <Link
              key={t}
              className={`join-item ${btnEnabled}`}
              href={hrefForPage(t)}
              aria-label={`Page ${t}`}
            >
              {t}
            </Link>
          ),
        )}

        {current === safeTotal ? (
          <span className={`join-item ${btnDisabled}`} aria-disabled="true" aria-label="Next page">
            »
          </span>
        ) : (
          <Link
            className={`join-item ${btnEnabled}`}
            href={hrefForPage(nextPage)}
            aria-label="Next page"
          >
            »
          </Link>
        )}
      </div>
    </nav>
  );
}
