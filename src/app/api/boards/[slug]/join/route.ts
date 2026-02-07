import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: board } = await supabase.from('boards').select('id').eq('slug', slug).single();
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const { error } = await supabase.from('board_members').insert({ user_id: user.id, board_id: board.id });
  if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: board } = await supabase.from('boards').select('id').eq('slug', slug).single();
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const { error } = await supabase.from('board_members').delete().eq('user_id', user.id).eq('board_id', board.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
