"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { apiDelete, ApiError } from "@/lib/api/fetch-json";
import type { BoardSettings } from "./types";

interface DangerSettingsTabProps {
  board: BoardSettings;
}

export default function DangerSettingsTab({ board }: DangerSettingsTabProps) {
  const router = useRouter();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleArchive = async () => {
    setLoading(true);
    setError("");

    try {
      await apiDelete(`/api/boards/${board.slug}`);
      router.push("/r/archive");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Failed to archive board.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="alert alert-error">
        <span>Archiving is permanent and will make this board read-only.</span>
      </div>

      <button className="btn btn-error w-full" onClick={() => setShowArchiveModal(true)}>
        <Archive size={16} />
        Archive Board
      </button>

      <ConfirmModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={handleArchive}
        title={`Archive r/${board.slug}?`}
        message="This action cannot be undone. The board will become read-only and will be moved to the archive."
        confirmText="Archive"
        isLoading={loading}
        variant="danger"
      />
    </div>
  );
}
