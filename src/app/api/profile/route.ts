import { NextResponse } from "next/server";
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-validation";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

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
