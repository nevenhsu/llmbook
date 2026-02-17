"use client";

import { useState, useEffect } from "react";

interface Board {
  id: string;
  name: string;
  slug: string;
}

interface BoardSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBoardId: string;
  selectedBoard: Board | null;
  onBoardSelect: (boardId: string, board: Board) => void;
  userJoinedBoards: Board[];
}

export default function BoardSelector({
  isOpen,
  onClose,
  selectedBoardId,
  selectedBoard,
  onBoardSelect,
  userJoinedBoards,
}: BoardSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedBoards, setSearchedBoards] = useState<Board[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search boards with debounce
  useEffect(() => {
    const searchBoards = async () => {
      if (searchQuery.trim().length === 0) {
        setSearchedBoards([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/boards/search?q=${encodeURIComponent(searchQuery)}&limit=10`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchedBoards(data.boards || []);
        }
      } catch (error) {
        console.error("Failed to search boards:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchBoards, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchedBoards([]);
    }
  }, [isOpen]);

  // Get display boards with selected board at the top
  const getDisplayBoards = (): Board[] => {
    let boards = searchQuery.trim() ? searchedBoards : userJoinedBoards;
    
    // If there's a selected board, ensure it's at the top
    if (selectedBoard && selectedBoardId) {
      // Remove selected board from list if it exists
      boards = boards.filter(b => b.id !== selectedBoardId);
      // Add selected board at the beginning
      boards = [selectedBoard, ...boards];
    }
    
    return boards;
  };

  const displayBoards = getDisplayBoards();

  const handleSelect = (board: Board) => {
    onBoardSelect(board.id, board);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      ></div>

      {/* Modal content */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto">
        <div className="bg-base-100 rounded-lg shadow-xl border border-neutral">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral">
            <h3 className="text-lg font-bold">Select a community</h3>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
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

          {/* Search input */}
          <div className="p-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search communities..."
              className="input input-bordered w-full"
              autoFocus
            />
          </div>

          {/* Board list - Fixed height with scroll */}
          <div className="h-[400px] overflow-y-auto p-4 space-y-2">
            {isSearching ? (
              <div className="flex items-center justify-center h-full">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : displayBoards.length === 0 ? (
              <div className="flex items-center justify-center h-full text-base-content/50 text-sm">
                {searchQuery.trim()
                  ? "No communities found"
                  : "No joined communities"}
              </div>
            ) : (
              <>
                {displayBoards.map((board) => {
                  const isSelected = selectedBoardId === board.id;
                  return (
                    <button
                      key={board.id}
                      onClick={() => handleSelect(board)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 transition-colors text-left ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "border border-transparent"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-base-300 flex-shrink-0">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5 text-base-content"
                        >
                          <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm5.21 13.91a4.93 4.93 0 0 1-3.6 1.76c-2.3 0-3.8-1.57-3.8-1.57s-1.5 1.57-3.8 1.57a4.93 4.93 0 0 1-3.6-1.76 2.05 2.05 0 0 1-.36-2.5 5.56 5.56 0 0 1 3.52-2.58 3.32 3.32 0 0 1 .44-.29 3.86 3.86 0 0 1-1.09-2.73 3.61 3.61 0 1 1 5.95-2.15 3.62 3.62 0 1 1 5.97 2.14 3.86 3.86 0 0 1-1.1 2.73 3.32 3.32 0 0 1 .45.3 5.56 5.56 0 0 1 3.52 2.58 2.05 2.05 0 0 1-.36 2.5Z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base-content text-sm">
                          r/{board.name}
                        </p>
                        <p className="text-xs text-base-content/50 truncate">
                          {board.slug}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded bg-primary border-2 border-primary flex items-center justify-center flex-shrink-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 text-base-100"
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
                        </div>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
