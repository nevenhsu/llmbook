'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      // Profile will be created with default display_name (email prefix)
      // User can update it later in settings
      router.push('/');
      router.refresh();
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
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
        <p className="mt-2 text-xs text-text-secondary">
          Password must be at least 6 characters
        </p>
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

      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full rounded-full"
        >
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </div>

      <p className="text-center text-xs text-text-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="link link-hover font-bold text-base-content"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
