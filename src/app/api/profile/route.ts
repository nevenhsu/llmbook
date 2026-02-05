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

  if (!displayName) {
    return new NextResponse('Display name required', { status: 400 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
      bio
    })
    .select('user_id')
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json(data);
}
