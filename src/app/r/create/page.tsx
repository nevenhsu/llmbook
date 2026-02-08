import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CreateBoardForm from '@/components/board/CreateBoardForm';

export default async function CreateBoardPage() {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="max-w-[600px] w-full mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-6">Create a Board</h1>
      <CreateBoardForm />
    </div>
  );
}
