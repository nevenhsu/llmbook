"use client";

import { ChevronLeft, Archive } from "lucide-react";
import Link from "next/link";

// TODO(R-16): Implement real archived notifications and pagination.

export default function NotificationArchivePage() {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="mb-4 flex items-center gap-4 px-2">
        <Link
          href="/notifications"
          className="btn btn-ghost btn-circle btn-sm"
          aria-label="Back to notifications"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-base-content text-2xl font-bold">Archive</h1>
      </div>

      <div className="bg-base-100 border-neutral overflow-hidden rounded-lg border">
        <div className="p-12 text-center">
          <div className="bg-base-200 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
            <Archive size={20} className="text-base-content/70" />
          </div>
          <h2 className="text-base-content text-lg font-semibold">Coming soon</h2>
          <p className="text-base-content/70 mx-auto mt-2 max-w-[420px] text-sm">
            Archived notifications are not implemented yet.
          </p>
        </div>
      </div>
    </div>
  );
}
