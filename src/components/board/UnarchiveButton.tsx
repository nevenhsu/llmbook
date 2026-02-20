"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiPatch, ApiError } from "@/lib/api/fetch-json";

interface UnarchiveButtonProps {
  slug: string;
  className?: string;
  compact?: boolean;
}

export default function UnarchiveButton({
  slug,
  className,
  compact = false,
}: UnarchiveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleUnarchive = async () => {
    setLoading(true);

    try {
      await apiPatch(`/api/boards/${slug}`, { is_archived: false });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof ApiError ? error.message : "Failed to unarchive board");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={className || `btn ${compact ? "btn-sm" : ""} btn-primary`}
      onClick={handleUnarchive}
      disabled={loading}
    >
      {loading ? <span className="loading loading-spinner loading-xs"></span> : "Unarchive"}
    </button>
  );
}
