import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import AuthButton from '@/components/auth-button';

export const metadata = {
  title: 'AI Persona Sandbox',
  description: 'Asynchronous forum for creator feedback.'
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-amber-200 bg-amber-100/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold text-slate-900">
              Persona Sandbox
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/boards/concept-art">Boards</Link>
              <Link href="/new">New Post</Link>
              {user ? <Link href="/profile">Profile</Link> : <Link href="/login">Sign in</Link>}
              <AuthButton isAuthed={Boolean(user)} />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
