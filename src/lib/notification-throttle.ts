import type { SupabaseClient } from "@supabase/supabase-js";

// Upvote milestone thresholds
export const UPVOTE_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

// Follower notification settings
const MAX_FOLLOWERS_TO_NOTIFY = 100;
const FOLLOWED_USER_POST_COOLDOWN_HOURS = 24;

/**
 * Check if an upvote should trigger a notification based on milestone logic
 * Only notify when crossing a milestone threshold
 */
export function shouldNotifyUpvote(oldScore: number, newScore: number): boolean {
  // Check if we crossed any of the predefined milestones
  for (const milestone of UPVOTE_MILESTONES) {
    if (oldScore < milestone && newScore >= milestone) {
      return true;
    }
  }

  // For scores >= 1000, notify every 1000 upvotes
  if (newScore >= 1000) {
    const oldThousands = Math.floor(oldScore / 1000);
    const newThousands = Math.floor(newScore / 1000);
    if (newThousands > oldThousands) {
      return true;
    }
  }

  return false;
}

/**
 * Get the milestone value that was just reached (if any)
 */
export function getReachedMilestone(oldScore: number, newScore: number): number | null {
  // Check predefined milestones
  for (const milestone of UPVOTE_MILESTONES) {
    if (oldScore < milestone && newScore >= milestone) {
      return milestone;
    }
  }

  // Check 1000+ milestones
  if (newScore >= 1000) {
    const oldThousands = Math.floor(oldScore / 1000);
    const newThousands = Math.floor(newScore / 1000);
    if (newThousands > oldThousands) {
      return newThousands * 1000;
    }
  }

  return null;
}

/**
 * Get followers who should receive a notification about a new post
 * Excludes followers who were notified about this author's posts in the last 24 hours
 */
export async function getFollowersToNotify(
  supabase: SupabaseClient,
  authorId: string,
): Promise<string[]> {
  // 1. Get followers (max 100)
  const { data: followers } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", authorId)
    .limit(MAX_FOLLOWERS_TO_NOTIFY);

  if (!followers || followers.length === 0) {
    return [];
  }

  const followerIds = followers.map((f) => f.follower_id);

  // 2. Check if these followers were notified about this author's posts in the last 24h
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - FOLLOWED_USER_POST_COOLDOWN_HOURS);

  // Query for recent followed_user_post notifications
  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("user_id, payload")
    .eq("type", "followed_user_post")
    .in("user_id", followerIds)
    .gte("created_at", twentyFourHoursAgo.toISOString());

  // Filter to only those from this specific author
  const notifiedRecently = new Set<string>();
  if (recentNotifications) {
    for (const notif of recentNotifications) {
      const payload = notif.payload as { authorId?: string };
      if (payload?.authorId === authorId) {
        notifiedRecently.add(notif.user_id);
      }
    }
  }

  // 3. Return followers who haven't been notified recently
  return followerIds.filter((id) => !notifiedRecently.has(id));
}
