import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { body } = await req.json();
  if (!body) return NextResponse.json({ error: 'Body is required' }, { status: 400 });

  const { data: comment, error } = await supabase
    .from('comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!comment) return NextResponse.json({ error: 'Comment not found or not author' }, { status: 403 });

  return NextResponse.json({ comment });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: comment, error } = await supabase
    .from('comments')
    .update({ is_deleted: true, body: '[deleted]' })
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!comment) return NextResponse.json({ error: 'Comment not found or not author' }, { status: 403 });

  return NextResponse.json({ success: true });
}
