"use client";

import { createContext, useContext, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
  karma: number;
}

interface UserContextData {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextData | null>(null);

export function UserProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: UserContextData;
}) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within UserProvider");
  }
  return context;
}

// Optional: hook that doesn't throw if context is missing (for public pages)
export function useOptionalUserContext() {
  return useContext(UserContext);
}
