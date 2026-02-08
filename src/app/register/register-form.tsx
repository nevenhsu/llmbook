'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import UsernameInput from '@/components/ui/UsernameInput';

export default function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // Validate username before submission
    if (!isUsernameValid) {
      setError('請輸入有效的 username');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      
      // Sign up user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('註冊失敗');
        setLoading(false);
        return;
      }

      // Update profile with username and display_name
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: username.toLowerCase(),
          display_name: displayName || username,
        })
        .eq('user_id', data.user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        // Continue anyway, user can update later
      }

      if (!data.session) {
        setNotice('請檢查您的電子郵件以確認帳號後再登入');
        setLoading(false);
        return;
      }

      // Redirect to home
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || '註冊時發生錯誤');
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {/* Username field */}
      <div>
        <UsernameInput
          value={username}
          onChange={setUsername}
          onValidChange={setIsUsernameValid}
          required
          label="Username"
          showRules={true}
          checkAvailability={true}
        />
        <p className="mt-2 text-xs text-text-secondary">
          您的 username 會顯示在 URL 中 (例如: yoursite.com/u/username)
        </p>
      </div>

      {/* Display Name field (optional) */}
      <div>
        <label className="text-sm font-semibold text-text-primary">
          顯示名稱 <span className="text-text-secondary font-normal">(選填)</span>
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded-xl border border-border-default bg-surface px-4 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-text-primary"
          placeholder={username || "您的顯示名稱"}
          maxLength={50}
        />
        <p className="mt-2 text-xs text-text-secondary">
          可使用中文、空格等。如不填寫，將使用 username 作為顯示名稱
        </p>
      </div>

      {/* Email field */}
      <div>
        <label className="text-sm font-semibold text-text-primary">
          Email <span className="text-upvote">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-xl border border-border-default bg-surface px-4 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-text-primary"
          placeholder="your.email@example.com"
          required
        />
      </div>

      {/* Password field */}
      <div>
        <label className="text-sm font-semibold text-text-primary">
          密碼 <span className="text-upvote">*</span>
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-xl border border-border-default bg-surface px-4 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-text-primary"
          placeholder="至少 6 個字元"
          required
          minLength={6}
        />
        <p className="mt-2 text-xs text-text-secondary">
          密碼長度至少 6 個字元
        </p>
      </div>

      {/* Error/Notice messages */}
      {error && (
        <div className="rounded-xl bg-downvote/10 border border-downvote/20 p-3 text-sm text-downvote">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl bg-upvote/10 border border-upvote/20 p-3 text-sm text-upvote">
          {notice}
        </div>
      )}

      {/* Submit button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={loading || !isUsernameValid}
          className="w-full rounded-full bg-upvote px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '建立中...' : '建立帳號'}
        </button>
      </div>

      {/* Sign in link */}
      <p className="text-center text-xs text-text-secondary">
        已經有帳號了？{' '}
        <Link
          href="/login"
          className="font-bold text-text-primary hover:text-upvote transition-colors"
        >
          登入
        </Link>
      </p>
    </form>
  );
}
