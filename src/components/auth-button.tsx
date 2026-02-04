'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthButton({ isAuthed }: { isAuthed: boolean }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  if (!isAuthed) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-sm text-slate-500 hover:text-slate-700"
    >
      Sign out
    </button>
  );
}
