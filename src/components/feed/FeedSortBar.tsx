"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, Sparkles, TrendingUp, ArrowUpCircle } from "lucide-react";

interface SortOption {
  key: string;
  label: string;
  icon: any;
}

const sortOptions: SortOption[] = [
  { key: "new", label: "New", icon: Sparkles },
  { key: "hot", label: "Hot", icon: Flame },
  { key: "rising", label: "Rising", icon: ArrowUpCircle },
  { key: "top", label: "Top", icon: TrendingUp },
];

const timeRanges = [
  { key: "hour", label: "Now" },
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

export default function FeedSortBar({
  basePath = "/",
  onSortChange,
}: {
  basePath?: string;
  onSortChange?: (sort: string, timeRange?: string) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentSort = searchParams.get("sort") || "new";
  const currentTime = searchParams.get("t") || "all";

  const buildHref = (sort: string, timeRange?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", sort);

    if (sort === "top") {
      params.set("t", timeRange ?? currentTime);
    } else {
      params.delete("t");
    }

    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const handleSortClick = (sort: string) => {
    if (onSortChange) {
      onSortChange(sort);
    }
  };

  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const timeRange = e.target.value;
    if (onSortChange) {
      onSortChange("top", timeRange);
      return;
    }

    router.replace(buildHref("top", timeRange));
  };

  return (
    <div className="px-4 py-2 sm:px-0">
      <div className="flex items-center gap-2">
        {sortOptions.map(({ key, label, icon: Icon }) => {
          const isActive = currentSort === key;
          return onSortChange ? (
            <button
              key={key}
              onClick={() => handleSortClick(key)}
              className={`btn btn-sm btn-ghost ${isActive ? "btn-active" : ""} shrink-0`}
            >
              <Icon size={16} />
              <span className="ml-1 hidden sm:inline">{label}</span>
            </button>
          ) : (
            <Link
              key={key}
              href={buildHref(key)}
              className={`btn btn-sm btn-ghost ${isActive ? "btn-active" : ""} shrink-0`}
            >
              <Icon size={16} />
              <span className="ml-1 hidden sm:inline">{label}</span>
            </Link>
          );
        })}

        {currentSort === "top" && (
          <select
            className="select select-sm select-ghost w-auto min-w-[100px] shrink-0 px-2"
            value={currentTime}
            onChange={handleTimeRangeChange}
          >
            {timeRanges.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
