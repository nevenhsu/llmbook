import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiPost } from "@/lib/api/fetch-json";

interface BannedUser {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  user?: { display_name?: string; avatar_url?: string | null };
  profiles?: { display_name?: string; avatar_url?: string | null };
}

interface UseBanManagementOptions {
  boardSlug: string;
  onBanned: (ban: BannedUser, bannedUserId: string) => void;
  onUnbanned: (userId: string) => void;
  onError: (message: string) => void;
}

export function useBanManagement({
  boardSlug,
  onBanned,
  onUnbanned,
  onError,
}: UseBanManagementOptions) {
  const router = useRouter();
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banExpiresAt, setBanExpiresAt] = useState("");
  const [banLoading, setBanLoading] = useState(false);
  const [unbanLoadingUserId, setUnbanLoadingUserId] = useState<string | null>(null);

  const banUser = async () => {
    if (!banUserId) {
      onError("Please select a member to ban.");
      return;
    }

    setBanLoading(true);

    try {
      const payload: Record<string, string> = { user_id: banUserId };
      if (banReason.trim()) payload.reason = banReason.trim();
      if (banExpiresAt) {
        const expiresAt = new Date(banExpiresAt);
        if (!Number.isNaN(expiresAt.getTime())) {
          payload.expires_at = expiresAt.toISOString();
        }
      }

      const ban = await apiPost<BannedUser>(`/api/boards/${boardSlug}/bans`, payload);
      onBanned(ban, ban.user_id);
      setBanUserId("");
      setBanReason("");
      setBanExpiresAt("");
      router.refresh();
    } catch (err) {
      console.error(err);
      onError("Failed to ban user.");
    } finally {
      setBanLoading(false);
    }
  };

  const unbanUser = async (userId: string) => {
    setUnbanLoadingUserId(userId);

    try {
      await apiDelete(`/api/boards/${boardSlug}/bans/${userId}`);
      onUnbanned(userId);
      router.refresh();
    } catch (err) {
      console.error(err);
      onError("Failed to unban user.");
    } finally {
      setUnbanLoadingUserId(null);
    }
  };

  const isUnbanning = (userId: string) => unbanLoadingUserId === userId;

  return {
    banForm: {
      userId: banUserId,
      reason: banReason,
      expiresAt: banExpiresAt,
      setUserId: setBanUserId,
      setReason: setBanReason,
      setExpiresAt: setBanExpiresAt,
    },
    banUser,
    unbanUser,
    isBanning: banLoading,
    isUnbanning,
  };
}
