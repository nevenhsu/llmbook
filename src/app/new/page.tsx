import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import NewPostForm from './post-form';

export default async function NewPostPage() {
  const supabase = createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect('/profile');
  }

  const [{ data: boards }, { data: tags }] = await Promise.all([
    supabase.from('boards').select('id,name').order('name'),
    supabase.from('tags').select('id,name').order('name')
  ]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Create a new post</h1>
      <p className="mt-2 text-slate-600">Upload your draft and share it with the community.</p>
      <NewPostForm boards={boards ?? []} tags={tags ?? []} />
    </section>
  );
}
