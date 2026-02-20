"use client";

import { useEffect, useState } from "react";

/**
 * Profile data returned by the hook
 */
interface ProfileData {
  /** User ID (null if not found or loading) */
  userId: string | null;

  /** Display name for the user */
  displayName: string;

  /** Loading state indicator */
  isLoading: boolean;

  /** Error object if fetch failed */
  error: Error | null;
}

/**
 * Fetch user profile data by username
 *
 * This hook converts a username to a user ID and retrieves basic profile
 * information from the API. It's commonly used on profile pages and user lists
 * where you have the username but need the user ID for further API calls.
 *
 * @param username - Username to fetch profile for
 * @returns Profile data with loading and error states
 *
 * @example
 * ```typescript
 * function UserProfile() {
 *   const params = useParams();
 *   const { userId, displayName, isLoading, error } = useProfileData(params.username);
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorMessage />;
 *   if (!userId) return <NotFound />;
 *
 *   return <div>User: {displayName}</div>;
 * }
 * ```
 */
export function useProfileData(username: string): ProfileData {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      // Reset state when username changes
      setIsLoading(true);
      setError(null);
      setUserId(null);
      setDisplayName("");

      try {
        const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch profile: ${res.statusText}`);
        }

        const data = await res.json();
        setUserId(data.user_id);
        setDisplayName(data.display_name || username);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    }

    if (username) {
      fetchProfile();
    } else {
      // No username provided
      setIsLoading(false);
    }
  }, [username]);

  return { userId, displayName, isLoading, error };
}
