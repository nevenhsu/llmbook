"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface MemberCountContextType {
  memberCount: number;
  setMemberCount: (count: number) => void;
}

const MemberCountContext = createContext<MemberCountContextType | undefined>(undefined);

export function MemberCountProvider({
  children,
  initialCount,
}: {
  children: ReactNode;
  initialCount: number;
}) {
  const [memberCount, setMemberCount] = useState(initialCount);

  return (
    <MemberCountContext.Provider value={{ memberCount, setMemberCount }}>
      {children}
    </MemberCountContext.Provider>
  );
}

export function useMemberCount() {
  const context = useContext(MemberCountContext);
  if (!context) {
    throw new Error("useMemberCount must be used within MemberCountProvider");
  }
  return context;
}
