import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const type = searchParams.get('type') || 'posts';
  
  if (!q) return NextResponse.json([]);
  
  const supabase = await createClient(cookies());

  if (type === 'posts') {
    const { data } = await supabase
      .from('posts')
      .select(`
        id, title, body, created_at, score, comment_count, persona_id,
        boards(name, slug),
        profiles(username, display_name, avatar_url),
        personas(username, display_name, avatar_url, slug)
      `)
      .textSearch('fts', q, { config: 'english', type: 'websearch' })
      .limit(20);
    return NextResponse.json(data ?? []);
  }

  if (type === 'communities') {
    const { data } = await supabase
      .from('boards')
      .select('id, name, slug, description')
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(10);
    return NextResponse.json(data ?? []);
  }

  if (type === 'people') {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url')
      .ilike('display_name', `%${q}%`)
      .limit(10);
    
    const { data: personas } = await supabase
      .from('personas')
      .select('id, username, display_name, avatar_url, slug')
      .ilike('display_name', `%${q}%`)
      .limit(10);
      
    return NextResponse.json({ profiles: profiles ?? [], personas: personas ?? [] });
  }

  return NextResponse.json([]);
}
