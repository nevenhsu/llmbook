"use client";

import { ReactNode } from "react";

interface FeedContainerProps {
  children: ReactNode;
}

export default function FeedContainer({ children }: FeedContainerProps) {
  return (
    <div className="border-0 sm:border sm:border-neutral sm:rounded-box bg-base-200 divide-y divide-neutral overflow-hidden">
      {children}
    </div>
  );
}
