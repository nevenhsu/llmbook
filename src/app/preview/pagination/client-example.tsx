"use client";

import { useState } from "react";
import PaginationClient from "@/components/ui/PaginationClient";

export default function ClientExample({
  initialPage,
  totalPages,
}: {
  initialPage: number;
  totalPages: number;
}) {
  const [page, setPage] = useState(initialPage);

  return (
    <div className="space-y-3">
      <div className="text-base-content/70 text-sm">Current page (client state): {page}</div>
      <PaginationClient page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
    </div>
  );
}
