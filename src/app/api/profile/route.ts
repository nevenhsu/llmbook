import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateUsernameFormat, sanitizeUsername } from '@/lib/username-validation';

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { username, displayName, avatarUrl, bio } = await request.json();

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('username,display_name,avatar_url,bio')
    .eq('user_id', user.id)
    .maybeSingle();

  // Validate and process username
  let nextUsername = existingProfile?.username;
  if (username !== undefined) {
    const cleanUsername = sanitizeUsername(String(username));
    
    // Validate format
    const validation = validateUsernameFormat(cleanUsername, false);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Check if username changed and is available
    if (cleanUsername !== existingProfile?.username) {
      // Check availability in profiles
      const { data: profileExists } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', cleanUsername)
        .neq('user_id', user.id)
        .maybeSingle();

      if (profileExists) {
        return NextResponse.json({ error: 'Username 已被使用' }, { status: 400 });
      }

      // Check availability in personas
      const { data: personaExists } = await supabase
        .from('personas')
        .select('username')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (personaExists) {
        return NextResponse.json({ error: 'Username 已被使用' }, { status: 400 });
      }
    }

    nextUsername = cleanUsername;
  }

  // Validate and process display name
  const nextDisplayName =
    displayName !== undefined
      ? String(displayName).trim()
      : existingProfile?.display_name ?? nextUsername ?? 'Unknown';

  if (!nextDisplayName) {
    return NextResponse.json({ error: 'Display name 不能為空' }, { status: 400 });
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
        return NextResponse.json({ error: 'Avatar URL 格式錯誤' }, { status: 400 });
      }
      nextAvatarUrl = trimmedAvatarUrl;
    }
  }

  // Update profile
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      username: nextUsername,
      display_name: nextDisplayName,
      avatar_url: nextAvatarUrl,
      bio: bio !== undefined ? bio : existingProfile?.bio ?? null
    })
    .select('user_id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data });
}
