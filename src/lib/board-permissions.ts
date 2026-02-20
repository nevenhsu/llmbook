import { cache } from "react";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ModeratorRecord {
  role: string;
  permissions: { manage_settings?: boolean; manage_posts?: boolean; manage_users?: boolean } | null;
}

/**
 * Fetch the full moderator record (role + permissions) for a user in a board.
 * Uses React cache() to deduplicate queries within the same server request.
 * Returns null if the user is not a moderator.
 */
const getBoardModeratorRecord = cache(
  async (boardId: string, userId: string): Promise<ModeratorRecord | null> => {
    const supabase = await createServerClient(cookies());
    const { data, error } = await supabase
      .from("board_moderators")
      .select("role, permissions")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as ModeratorRecord;
  },
);

/**
 * Check if a user is a moderator of a board
 */
export async function isBoardModerator(
  boardId: string,
  userId: string,
  _supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId);
  return record !== null;
}

/**
 * Check if a user is the owner of a board
 */
export async function isBoardOwner(
  boardId: string,
  userId: string,
  _supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId);
  return record?.role === "owner";
}

/**
 * Check if a user is banned from a board
 */
export async function isUserBanned(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  const sb = supabase ?? (await createServerClient(cookies()));

  const { data, error } = await sb
    .from("board_bans")
    .select("id, expires_at")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;

  // Check if ban has expired
  if (data.expires_at) {
    const expiryDate = new Date(data.expires_at);
    if (expiryDate < new Date()) {
      return false; // Ban expired
    }
  }

  return true; // Permanent ban or not expired
}

/**
 * Check if a user can post in a board
 */
export async function canPostInBoard(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  const sb = supabase ?? (await createServerClient(cookies()));

  // Check if board is archived
  const { data: board } = await sb.from("boards").select("is_archived").eq("id", boardId).single();

  if (board?.is_archived) return false;

  // Check if user is banned
  const banned = await isUserBanned(boardId, userId, sb);
  return !banned;
}

/**
 * Check if a user can manage board settings
 */
export async function canManageBoard(
  boardId: string,
  userId: string,
  _supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId);
  if (!record) return false;
  if (record.role === "owner") return true;
  return record.permissions?.manage_settings === true;
}

/**
 * Check if a user can manage board posts (archive/remove)
 */
export async function canManageBoardPosts(
  boardId: string,
  userId: string,
  _supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId);
  if (!record) return false;
  if (record.role === "owner") return true;
  return record.permissions?.manage_posts === true;
}

/**
 * Check if a user can manage board users (ban/kick)
 */
export async function canManageBoardUsers(
  boardId: string,
  userId: string,
  _supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId);
  if (!record) return false;
  if (record.role === "owner") return true;
  return record.permissions?.manage_users === true;
}

/**
 * Get user's role in a board (owner, moderator, or null)
 */
export async function getUserBoardRole(
  boardId: string,
  userId: string,
  _supabase?: SupabaseClient,
): Promise<"owner" | "moderator" | null> {
  const record = await getBoardModeratorRecord(boardId, userId);
  if (!record) return null;
  return record.role as "owner" | "moderator";
}
