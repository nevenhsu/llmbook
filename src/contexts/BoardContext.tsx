"use client";

import { createContext, useContext, ReactNode } from "react";
import { useUserContext, useOptionalUserContext } from "./UserContext";

interface BoardContextData {
  boardId: string;
  boardSlug: string;
  isModerator: boolean;
  canModerate: boolean;
}

// Extended interface that includes user data
interface BoardContextWithUser extends BoardContextData {
  userId: string | null;
  isAdmin: boolean;
}

const BoardContext = createContext<BoardContextData | null>(null);

export function BoardProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: BoardContextData;
}) {
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

/**
 * Hook that provides board-specific context along with user data from UserContext.
 * Must be used within both BoardProvider and UserProvider.
 */
export function useBoardContext(): BoardContextWithUser {
  const boardContext = useContext(BoardContext);
  const userContext = useUserContext();

  if (!boardContext) {
    throw new Error("useBoardContext must be used within BoardProvider");
  }

  return {
    ...boardContext,
    userId: userContext.user?.id || null,
    isAdmin: userContext.isAdmin,
  };
}

// Optional: hook that doesn't throw if context is missing (for components used outside board pages)
export function useOptionalBoardContext() {
  const boardContext = useContext(BoardContext);
  const userContext = useOptionalUserContext();

  if (!boardContext) {
    return null;
  }

  return {
    ...boardContext,
    userId: userContext?.user?.id || null,
    isAdmin: userContext?.isAdmin || false,
  };
}
