import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient(cookies());
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id,title,body,created_at,
       boards(name,slug),
       profiles(display_name),
       media(id,url),
       post_tags(tag:tags(name,slug))`
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.json(data);
}
