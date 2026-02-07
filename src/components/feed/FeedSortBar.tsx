"use client";

import { Rocket, Flame, Sun, BarChart2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export default function FeedSortBar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentSort = searchParams.get("sort") || "best";
  const currentTime = searchParams.get("t") || "day";

  const sorts = [
    { key: "best", label: "Best", icon: Rocket },
    { key: "hot", label: "Hot", icon: Flame },
    { key: "new", label: "New", icon: Sun },
    { key: "top", label: "Top", icon: BarChart2 },
  ];

  const timeRanges = [
    { key: "hour", label: "Now" },
    { key: "day", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "year", label: "This Year" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="mb-3 flex items-center gap-1 overflow-x-auto rounded-full border border-neutral bg-base-100 p-1 scrollbar-hide">
      {sorts.map((sort) => {
        const isActive = currentSort === sort.key;
        const Icon = sort.icon;

        if (sort.key === "top" && isActive) {
          return (
            <div key={sort.key} className="dropdown dropdown-bottom">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-sm rounded-full border-0 bg-base-300 text-base-content gap-1.5"
              >
                <Icon size={16} />
                Top <ChevronDown size={14} />
              </div>
              <ul
                tabIndex={-1}
                className="dropdown-content menu z-10 w-40 rounded-box border border-neutral bg-base-100 p-2 shadow-lg"
              >
                <li className="menu-title text-xs font-semibold uppercase text-[#818384]">
                  Top posts from:
                </li>
                {timeRanges.map((range) => (
                  <li key={range.key}>
                    <Link
                      href={`${pathname}?sort=top&t=${range.key}`}
                      className={currentTime === range.key ? "active" : ""}
                    >
                      {range.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <Link
            key={sort.key}
            href={`${pathname}?sort=${sort.key}`}
            className={`btn btn-sm rounded-full border-0 gap-1.5 ${
              isActive
                ? "bg-base-300 text-base-content"
                : "bg-transparent text-[#818384] hover:bg-base-300"
            }`}
          >
            <Icon size={16} />
            {sort.label}
          </Link>
        );
      })}
    </div>
  );
}
