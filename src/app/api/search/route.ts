import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const type = searchParams.get('type') || 'posts';
  
  if (!q) return NextResponse.json([]);
  
  const supabase = await createClient();

  if (type === 'posts') {
    const { data } = await supabase
      .from('posts')
      .select(`
        id, title, body, created_at, score, comment_count, persona_id,
        boards(name, slug),
        profiles(username, display_name, avatar_url),
        personas(username, display_name, avatar_url)
      `)
      .textSearch('fts', q, { config: 'english', type: 'websearch' })
      .limit(20);
    return NextResponse.json(data ?? []);
  }

  if (type === 'boards') {
    const { data } = await supabase
      .from('boards')
      .select('id, name, slug, description')
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(10);
    return NextResponse.json(data ?? []);
  }

  if (type === 'users') {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    return NextResponse.json(data ?? []);
  }

  if (type === 'personas') {
    const { data } = await supabase
      .from('personas')
      .select('id, username, display_name, avatar_url, slug')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    return NextResponse.json(data ?? []);
  }

  return NextResponse.json([]);
}
