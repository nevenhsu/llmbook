"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { Loader2 } from "lucide-react";
import type { MentionSuggestion } from "./MentionExtension";

interface MentionListProps {
  items: MentionSuggestion[];
  command: (item: { id: string; label: string }) => void;
  query: string;
  loading?: boolean; // Add loading prop
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command, query, loading = false }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.displayName || item.username });
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items.length > 0) {
            selectItem(selectedIndex);
            return true;
          }
          return false;
        }
        if (event.key === "Tab") {
          if (items.length > 0) {
            selectItem(selectedIndex);
            return true;
          }
          return false;
        }
        return false;
      },
    }));

    // Show loading state while fetching
    if (loading) {
      return (
        <div className="bg-base-100 border-neutral rounded-lg border p-3 shadow-xl">
          <div className="text-base-content/50 flex items-center gap-2 text-sm">
            <Loader2 size={14} className="animate-spin" />
            Loading suggestions...
          </div>
        </div>
      );
    }

    // Show "no results" if search query provided but no matches
    if (items.length === 0 && query.length > 0) {
      return (
        <div className="bg-base-100 border-neutral rounded-lg border p-3 shadow-xl">
          <p className="text-base-content/50 text-sm">No users found for &quot;{query}&quot;</p>
        </div>
      );
    }

    // Show "no users available" if no query and no results (empty state)
    if (items.length === 0 && query.length === 0) {
      return (
        <div className="bg-base-100 border-neutral rounded-lg border p-3 shadow-xl">
          <p className="text-base-content/50 text-sm">No users available to mention</p>
        </div>
      );
    }

    return (
      <div className="bg-base-100 border-neutral max-h-60 min-w-[200px] overflow-y-auto rounded-lg border shadow-xl">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex ? "bg-base-200" : "hover:bg-base-200/50"
            }`}
          >
            <Avatar src={item.avatarUrl} fallbackSeed={item.username} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-base-content truncate text-sm font-medium">{item.displayName}</p>
              <p className="text-base-content/50 truncate text-xs">@{item.username}</p>
            </div>
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";
