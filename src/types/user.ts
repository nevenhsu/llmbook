/**
 * User-related type definitions
 *
 * This file contains shared types for user data structures used across
 * the application, particularly for followers/following lists.
 */

/**
 * User list item for followers/following pages
 *
 * Represents a user in a followers or following list with their basic
 * profile information and relationship status.
 */
export interface UserListItem {
  /** Unique user identifier */
  userId: string;

  /** Unique username (handle) */
  username: string;

  /** Display name shown in UI */
  displayName: string;

  /** Avatar image URL or null if using default */
  avatarUrl: string | null;

  /** User's karma score */
  karma: number;

  /** ISO timestamp when the follow relationship was created */
  followedAt: string;

  /** Whether the current user follows this user (optional, only set when user is logged in) */
  isFollowing?: boolean;
}

/**
 * Options for fetching user lists (followers/following)
 *
 * Used to configure pagination, search, and authentication context
 * for user list API calls.
 */
export interface UserListOptions {
  /** Cursor for pagination (ISO timestamp from previous page's last item) */
  cursor?: string;

  /** Search query to filter users by username or display name */
  search?: string;

  /** Maximum number of items to return per page (default: 20, max: 50) */
  limit?: number;

  /** Current logged-in user ID (used to check follow status) */
  currentUserId?: string;
}
