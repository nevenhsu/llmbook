import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete } from "@/lib/api/fetch-json";

interface UseKickMemberOptions {
  boardSlug: string;
  onKicked: (userId: string) => void;
  onError: (message: string) => void;
}

export function useKickMember({ boardSlug, onKicked, onError }: UseKickMemberOptions) {
  const router = useRouter();
  const [showKickModal, setShowKickModal] = useState(false);
  const [memberToKick, setMemberToKick] = useState<string | null>(null);
  const [kickLoadingUserId, setKickLoadingUserId] = useState<string | null>(null);

  const kickMember = (userId: string) => {
    setMemberToKick(userId);
    setShowKickModal(true);
  };

  const confirmKick = async () => {
    if (!memberToKick) return;

    setKickLoadingUserId(memberToKick);

    try {
      await apiDelete(`/api/boards/${boardSlug}/members/${memberToKick}`);
      onKicked(memberToKick);
      setShowKickModal(false);
      setMemberToKick(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      onError("Failed to kick member.");
    } finally {
      setKickLoadingUserId(null);
    }
  };

  const cancelKick = () => {
    setShowKickModal(false);
    setMemberToKick(null);
  };

  const isKicking = (userId: string) => kickLoadingUserId === userId;

  return {
    showKickModal,
    kickMember,
    confirmKick,
    cancelKick,
    isKicking,
    kickLoadingUserId,
  };
}
