import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import NewPostForm from './post-form';

export default async function NewPostPage() {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, username, display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    // Redirect to login if no profile found
    redirect('/login');
  }

  const [{ data: boards }, { data: tags }] = await Promise.all([
    supabase.from('boards').select('id,name').order('name'),
    supabase.from('tags').select('id,name').order('name')
  ]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-base-content">Create a new post</h1>
      <p className="mt-2 text-base-content/70">Upload your draft and share it with the community.</p>
      <NewPostForm boards={boards ?? []} tags={tags ?? []} />
    </section>
  );
}
