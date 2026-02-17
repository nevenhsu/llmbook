"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetchJson, apiPost } from "@/lib/api/fetch-json";
import toast from "react-hot-toast";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface TagSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export default function TagSelector({
  isOpen,
  onClose,
  selectedTagIds,
  onTagsChange,
}: TagSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [displayedTags, setDisplayedTags] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Load initial 10 tags on mount
  useEffect(() => {
    if (isOpen) {
      loadInitialTags();
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadInitialTags = async () => {
    try {
      setIsLoading(true);
      // Load only the 10 most recent tags
      const tags = await apiFetchJson<Tag[]>("/api/tags?limit=10");
      setDisplayedTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
      toast.error("無法載入標籤");
    } finally {
      setIsLoading(false);
    }
  };

  // Search tags with debounce
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If no search query, load initial tags
    if (!searchQuery.trim()) {
      loadInitialTags();
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const tags = await apiFetchJson<Tag[]>(
          `/api/tags?search=${encodeURIComponent(searchQuery.trim())}`,
        );
        setDisplayedTags(tags);
      } catch (error) {
        console.error("Failed to search tags:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const hasExactMatch = displayedTags.some(
    (tag) => tag.name.toLowerCase() === searchQuery.toLowerCase().trim(),
  );

  const isValidTagName = (name: string): boolean => {
    // Only allow English letters, numbers, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(name);
  };

  const handleCreateTag = async () => {
    const tagName = searchQuery.trim();

    if (!tagName) {
      toast.error("請輸入標籤名稱");
      return;
    }

    if (!isValidTagName(tagName)) {
      toast.error("標籤名稱只能包含英文字母、數字、連字號和底線");
      return;
    }

    try {
      setIsCreating(true);
      const newTag = await apiPost<Tag>("/api/tags", { name: tagName });

      // Add new tag to displayed list
      setDisplayedTags((prev) => [newTag, ...prev]);

      // Select the new tag
      onTagsChange([...selectedTagIds, newTag.id]);

      // Clear search
      setSearchQuery("");

      toast.success(`已創建標籤「${newTag.name}」`);
    } catch (error: any) {
      console.error("Failed to create tag:", error);
      toast.error(error.message || "無法創建標籤");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter((id) => id !== tagId));
  };

  // Get selected tags - need to fetch them if not in displayed list
  const selectedTags = displayedTags.filter((tag) => selectedTagIds.includes(tag.id));

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[110] bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div className="bg-base-100 border-base-300 flex h-[600px] w-full max-w-md flex-col rounded-lg border-2 shadow-2xl">
          {/* Header */}
          <div className="border-neutral flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-bold">選擇標籤</h2>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Selected tags */}
          {selectedTags.length > 0 && (
            <div className="border-neutral border-b p-4">
              <p className="text-base-content/70 mb-2 text-xs">已選擇：</p>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="bg-primary/20 text-primary flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="hover:bg-primary/30 rounded-full p-0.5 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search input */}
          <div className="border-neutral border-b p-4">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋或創建標籤（僅限英文）"
              className="input input-bordered w-full"
              disabled={isCreating}
            />
            <p className="text-base-content/50 mt-1 text-xs">
              只能使用英文字母、數字、連字號和底線
            </p>
          </div>

          {/* Tag list - fixed height with scroll */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : (
              <>
                {/* Create new tag option */}
                {searchQuery.trim() && !hasExactMatch && isValidTagName(searchQuery.trim()) && (
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={isCreating}
                    className="border-primary/30 hover:border-primary hover:bg-primary/5 w-full rounded-lg border-2 border-dashed px-4 py-3 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-primary h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span className="text-primary text-sm font-medium">
                        創建 &quot;{searchQuery.trim()}&quot;
                      </span>
                    </div>
                  </button>
                )}

                {/* Invalid tag name warning */}
                {searchQuery.trim() && !hasExactMatch && !isValidTagName(searchQuery.trim()) && (
                  <div className="bg-warning/10 border-warning/30 rounded-lg border px-4 py-3">
                    <p className="text-warning text-sm">
                      標籤名稱只能包含英文字母、數字、連字號和底線
                    </p>
                  </div>
                )}

                {/* Existing tags */}
                {displayedTags.length === 0 && !searchQuery.trim() && !isLoading && (
                  <p className="text-base-content/50 py-8 text-center text-sm">尚無標籤</p>
                )}

                {displayedTags.length === 0 &&
                  searchQuery.trim() &&
                  !isValidTagName(searchQuery.trim()) &&
                  !isSearching && (
                    <p className="text-base-content/50 py-4 text-center text-sm">
                      請輸入有效的標籤名稱
                    </p>
                  )}

                {displayedTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={`hover:bg-base-300 w-full rounded-lg px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary/30 border"
                          : "border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                            isSelected ? "bg-primary border-primary" : "border-neutral"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="text-base-100 h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${isSelected ? "text-primary font-bold" : ""}`}>
                          {tag.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-neutral flex justify-end gap-2 border-t p-4">
            <button type="button" onClick={onClose} className="btn btn-primary">
              完成
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
