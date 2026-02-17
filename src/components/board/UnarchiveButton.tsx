"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

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
      const res = await fetch(`/api/boards/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: false }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to unarchive board");
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
