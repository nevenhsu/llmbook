import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function PUT(request: Request) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { displayName, avatarUrl, bio } = await request.json();

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('display_name,avatar_url,bio')
    .eq('user_id', user.id)
    .maybeSingle();

  const nextDisplayName =
    displayName !== undefined
      ? String(displayName).trim()
      : existingProfile?.display_name ?? user.email?.split('@')[0] ?? 'Unknown';

  if (!nextDisplayName) {
    return new NextResponse('Display name required', { status: 400 });
  }

  let nextAvatarUrl: string | null = existingProfile?.avatar_url ?? null;
  if (avatarUrl !== undefined) {
    const trimmedAvatarUrl = String(avatarUrl).trim();
    if (!trimmedAvatarUrl) {
      nextAvatarUrl = null;
    } else {
      try {
        new URL(trimmedAvatarUrl);
      } catch {
        return new NextResponse('Invalid avatar URL', { status: 400 });
      }
      nextAvatarUrl = trimmedAvatarUrl;
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      display_name: nextDisplayName,
      avatar_url: nextAvatarUrl,
      bio: bio !== undefined ? bio : existingProfile?.bio ?? null
    })
    .select('user_id')
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json(data);
}
