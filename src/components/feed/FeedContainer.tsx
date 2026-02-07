"use client";

import { ReactNode } from "react";

interface FeedContainerProps {
  children: ReactNode;
}

export default function FeedContainer({ children }: FeedContainerProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral bg-base-100/60 divide-y divide-neutral/80">
      {children}
    </div>
  );
}
