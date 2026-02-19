import { NextResponse } from "next/server";
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/profile
 * - Without username param: Returns current user's profile (requires auth)
 * - With ?username=xxx: Returns public profile data for that username
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  const supabase = await createClient();

  // If username is provided, return public profile data
  if (username) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url, bio, follower_count, following_count")
      .ilike("username", username.toLowerCase())
      .maybeSingle();

    if (!profile) {
      return http.notFound("User not found");
    }

    return http.ok(profile);
  }

  // Otherwise, return current user's profile (requires auth)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return http.unauthorized("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, bio, follower_count, following_count")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return http.notFound("Profile not found");
  }

  return http.ok(profile);
}

export const PUT = withAuth(async (request, { user, supabase }) => {
  const body = await parseJsonBody<{
    username?: unknown;
    displayName?: unknown;
    avatarUrl?: unknown;
    bio?: unknown;
  }>(request);
  if (body instanceof NextResponse) {
    return body;
  }

  const { username, displayName, avatarUrl, bio } = body;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("username,display_name,avatar_url,bio")
    .eq("user_id", user.id)
    .maybeSingle();

  // Validate and process username
  let nextUsername = existingProfile?.username;
  if (username !== undefined) {
    const cleanUsername = sanitizeUsername(String(username));

    // Validate format
    const validation = validateUsernameFormat(cleanUsername, false);
    if (!validation.valid) {
      return http.badRequest(validation.error);
    }

    // Check if username changed and is available
    if (cleanUsername !== existingProfile?.username) {
      // Check availability in profiles
      const { data: profileExists } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", cleanUsername)
        .neq("user_id", user.id)
        .maybeSingle();

      if (profileExists) {
        return http.badRequest("Username 已被使用");
      }

      // Check availability in personas
      const { data: personaExists } = await supabase
        .from("personas")
        .select("username")
        .ilike("username", cleanUsername)
        .maybeSingle();

      if (personaExists) {
        return http.badRequest("Username 已被使用");
      }
    }

    nextUsername = cleanUsername;
  }

  // Validate and process display name
  const nextDisplayName =
    displayName !== undefined
      ? String(displayName).trim()
      : (existingProfile?.display_name ?? nextUsername ?? "Unknown");

  if (!nextDisplayName) {
    return http.badRequest("Display name 不能為空");
  }

  // Validate and process avatar URL
  let nextAvatarUrl: string | null = existingProfile?.avatar_url ?? null;
  if (avatarUrl !== undefined) {
    const trimmedAvatarUrl = String(avatarUrl).trim();
    if (!trimmedAvatarUrl) {
      nextAvatarUrl = null;
    } else {
      try {
        new URL(trimmedAvatarUrl);
      } catch {
        return http.badRequest("Avatar URL 格式錯誤");
      }
      nextAvatarUrl = trimmedAvatarUrl;
    }
  }

  // Update profile
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      user_id: user.id,
      username: nextUsername,
      display_name: nextDisplayName,
      avatar_url: nextAvatarUrl,
      bio: bio !== undefined ? bio : (existingProfile?.bio ?? null),
    })
    .select("user_id")
    .single();

  if (error) {
    return http.badRequest(error.message);
  }

  return http.ok({ success: true, data });
});
