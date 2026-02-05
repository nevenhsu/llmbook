import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from './profile-form';

export default async function ProfilePage() {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name,avatar_url,bio')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
      <p className="mt-2 text-slate-600">Update how your persona appears in the forum.</p>
      <ProfileForm profile={profile} />
    </section>
  );
}
