import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiPost } from "@/lib/api/fetch-json";

type BanEntityType = "profile" | "persona";

interface BannedEntity {
  id: string;
  entity_type: BanEntityType;
  entity_id: string;
  reason: string | null;
  expires_at: string | null;
  user?: { display_name?: string; avatar_url?: string | null };
  profiles?: { display_name?: string; avatar_url?: string | null };
}

interface UseBanManagementOptions {
  boardSlug: string;
  onBanned: (ban: BannedEntity, target: { entityType: BanEntityType; entityId: string }) => void;
  onUnbanned: (target: { entityType: BanEntityType; entityId: string }) => void;
  onError: (message: string) => void;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function useBanManagement({
  boardSlug,
  onBanned,
  onUnbanned,
  onError,
}: UseBanManagementOptions) {
  const router = useRouter();
  const [banTarget, setBanTarget] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banExpiresAt, setBanExpiresAt] = useState("");
  const [banLoading, setBanLoading] = useState(false);
  const [unbanLoadingTarget, setUnbanLoadingTarget] = useState<string | null>(null);

  const banUser = async () => {
    const trimmedTarget = banTarget.trim();
    if (!trimmedTarget) {
      onError("Please enter username or select a member to ban.");
      return;
    }

    setBanLoading(true);

    try {
      const normalizedTarget = trimmedTarget.replace(/^@/, "").toLowerCase();
      const payload: Record<string, string> = isUuid(normalizedTarget)
        ? { user_id: normalizedTarget }
        : { username: normalizedTarget };

      if (banReason.trim()) payload.reason = banReason.trim();
      if (banExpiresAt) {
        const expiresAt = new Date(banExpiresAt);
        if (!Number.isNaN(expiresAt.getTime())) {
          payload.expires_at = expiresAt.toISOString();
        }
      }

      const ban = await apiPost<BannedEntity>(`/api/boards/${boardSlug}/bans`, payload);
      onBanned(ban, { entityType: ban.entity_type, entityId: ban.entity_id });
      setBanTarget("");
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

  const unbanUser = async (entityId: string, entityType: BanEntityType = "profile") => {
    if (!entityId) {
      onError("Invalid ban target.");
      return;
    }

    const targetKey = `${entityType}:${entityId}`;
    setUnbanLoadingTarget(targetKey);

    try {
      await apiDelete(`/api/boards/${boardSlug}/bans/${entityType}/${entityId}`);
      onUnbanned({ entityType, entityId });
      router.refresh();
    } catch (err) {
      console.error(err);
      onError("Failed to unban user.");
    } finally {
      setUnbanLoadingTarget(null);
    }
  };

  const isUnbanning = (entityId: string, entityType: BanEntityType = "profile") =>
    unbanLoadingTarget === `${entityType}:${entityId}`;

  return {
    banForm: {
      userId: banTarget,
      reason: banReason,
      expiresAt: banExpiresAt,
      setUserId: setBanTarget,
      setReason: setBanReason,
      setExpiresAt: setBanExpiresAt,
    },
    banUser,
    unbanUser,
    isBanning: banLoading,
    isUnbanning,
  };
}
