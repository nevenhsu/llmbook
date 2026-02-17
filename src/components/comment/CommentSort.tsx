"use client";

import { ChevronDown } from "lucide-react";
import ResponsiveMenu from "@/components/ui/ResponsiveMenu";

const sortOptions = [
  { key: "new", label: "New" },
  { key: "best", label: "Best" },
  { key: "top", label: "Top" },
  { key: "old", label: "Old" },
];

interface CommentSortProps {
  currentSort: string;
  onChange: (sort: string) => void;
}

export default function CommentSort({ currentSort, onChange }: CommentSortProps) {
  const currentLabel = sortOptions.find((o) => o.key === currentSort)?.label ?? currentSort;

  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-base-content/70 text-xs font-bold uppercase">Sort by:</span>
      <ResponsiveMenu
        trigger={
          <span className="text-primary flex items-center gap-1 text-xs font-bold">
            {currentLabel}
            <ChevronDown size={12} />
          </span>
        }
        title="Sort comments"
        ariaLabel="Sort comments"
        triggerClassName="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        {sortOptions.map((opt) => (
          <li key={opt.key}>
            <button
              onClick={() => onChange(opt.key)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                opt.key === currentSort
                  ? "text-primary bg-primary/10 font-bold"
                  : "text-base-content hover:bg-base-300"
              }`}
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ResponsiveMenu>
    </div>
  );
}
