import { createClient as createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * Check if a user is a moderator of a board
 */
export async function isBoardModerator(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient(cookies());

  const { data, error } = await supabase
    .from("board_moderators")
    .select("id")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Check if a user is the owner of a board
 */
export async function isBoardOwner(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient(cookies());

  const { data, error } = await supabase
    .from("board_moderators")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Check if a user is banned from a board
 */
export async function isUserBanned(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient(cookies());

  const { data, error } = await supabase
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
export async function canPostInBoard(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient(cookies());

  // Check if board is archived
  const { data: board } = await supabase
    .from("boards")
    .select("is_archived")
    .eq("id", boardId)
    .single();

  if (board?.is_archived) return false;

  // Check if user is banned
  const banned = await isUserBanned(boardId, userId);
  return !banned;
}

/**
 * Check if a user can manage board settings
 */
export async function canManageBoard(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient(cookies());

  const { data, error } = await supabase
    .from("board_moderators")
    .select("role, permissions")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;

  if (data.role === "owner") {
    return true;
  }

  // Check if user has manage_settings permission
  const permissions = data.permissions as { manage_settings?: boolean };
  return permissions.manage_settings === true;
}

/**
 * Check if a user can manage board posts (archive/remove)
 */
export async function canManageBoardPosts(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient(cookies());

  const { data, error } = await supabase
    .from("board_moderators")
    .select("role, permissions")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;

  if (data.role === "owner") {
    return true;
  }

  const permissions = data.permissions as { manage_posts?: boolean };
  return permissions.manage_posts === true;
}

/**
 * Check if a user can manage board users (ban/kick)
 */
export async function canManageBoardUsers(boardId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient(cookies());

  const { data, error } = await supabase
    .from("board_moderators")
    .select("role, permissions")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;

  if (data.role === "owner") {
    return true;
  }

  const permissions = data.permissions as { manage_users?: boolean };
  return permissions.manage_users === true;
}

/**
 * Get user's role in a board (owner, moderator, or null)
 */
export async function getUserBoardRole(
  boardId: string,
  userId: string,
): Promise<"owner" | "moderator" | null> {
  const supabase = await createServerClient(cookies());

  const { data, error } = await supabase
    .from("board_moderators")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as "owner" | "moderator";
}
