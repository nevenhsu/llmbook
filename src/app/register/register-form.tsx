'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setNotice('Check your email to confirm your account before signing in.');
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        display_name: displayName
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="space-y-4 px-4 sm:px-0">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="input input-bordered w-full rounded-full bg-base-300 border-neutral focus:border-primary"
            placeholder="Display name"
            required
          />
        </div>
        <div>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input input-bordered w-full rounded-full bg-base-300 border-neutral focus:border-primary"
            placeholder="Email"
            required
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input input-bordered w-full rounded-full bg-base-300 border-neutral focus:border-primary"
            placeholder="Password"
            required
          />
        </div>

        {error && (
          <div className="alert alert-error text-sm py-2">
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="alert alert-info text-sm py-2">
            <span>{notice}</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full rounded-full"
          >
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </div>

        <p className="text-center text-xs text-[#818384] mt-4">
          Already have an account?{' '}
          <Link
            href="/login"
            className="link link-hover font-bold text-base-content"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
