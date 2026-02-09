"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UsernameInput from "@/components/ui/UsernameInput";
import toast from "react-hot-toast";

interface Profile {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function ProfileForm({ profile }: { profile: Profile | null }) {
  const [username, setUsername] = useState(profile?.username ?? "");
  const [isUsernameValid, setIsUsernameValid] = useState(true);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isUsernameValid) {
      toast.error('請輸入有效的 username');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: username.toLowerCase(),
          displayName, 
          avatarUrl, 
          bio 
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '更新失敗');
      }

      toast.success('個人資料已更新');
      router.refresh();
      
      // If username changed, redirect to new profile URL
      if (username.toLowerCase() !== profile?.username?.toLowerCase()) {
        setTimeout(() => {
          router.push(`/u/${username.toLowerCase()}`);
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.message || '更新失敗');
    } finally {
      setLoading(false);
    }
  }

  const usernameChanged = username.toLowerCase() !== profile?.username?.toLowerCase();

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Username field */}
      <div>
        <UsernameInput
          value={username}
          onChange={setUsername}
          onValidChange={setIsUsernameValid}
          required
          label="Username"
          showRules={true}
          checkAvailability={usernameChanged}
        />
        {usernameChanged && (
          <div className="mt-2 rounded-lg bg-base-300 p-3 text-xs text-base-content/70">
            <p className="font-semibold text-base-content mb-1">⚠️ 注意</p>
            <p>修改 username 會改變您的個人頁面 URL：</p>
            <p className="mt-1 font-mono">
              <span className="line-through opacity-50">/u/{profile?.username}</span>
              {' → '}
              <span className="text-upvote">/u/{username.toLowerCase()}</span>
            </p>
          </div>
        )}
      </div>

      {/* Display name field */}
      <div>
        <label className="text-sm font-semibold text-base-content">
          顯示名稱 <span className="text-upvote">*</span>
        </label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral bg-base-100 px-4 py-2.5 text-sm text-base-content outline-none transition-colors placeholder:text-base-content/50 focus:"
          placeholder="人們看到的名稱"
          required
          maxLength={50}
        />
        <p className="mt-2 text-xs text-base-content/70">
          可使用中文、空格等特殊字元
        </p>
      </div>

      {/* Avatar URL field */}
      <div>
        <label className="text-sm font-semibold text-base-content">
          頭像 URL <span className="text-base-content/70 font-normal">(選填)</span>
        </label>
        <input
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral bg-base-100 px-4 py-2.5 text-sm text-base-content outline-none transition-colors placeholder:text-base-content/50 focus:"
          placeholder="https://..."
          type="url"
        />
        <p className="mt-2 text-xs text-base-content/70">
          或前往 <a href="/settings/avatar" className="text-upvote hover:underline">頭像設定</a> 上傳圖片
        </p>
      </div>

      {/* Bio field */}
      <div>
        <label className="text-sm font-semibold text-base-content">
          個人簡介 <span className="text-base-content/70 font-normal">(選填)</span>
        </label>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral bg-base-100 px-4 py-2.5 text-sm text-base-content outline-none transition-colors placeholder:text-base-content/50 focus:"
          placeholder="告訴大家你的興趣"
          rows={4}
          maxLength={500}
        />
        <p className="mt-1 text-xs text-base-content/70 text-right">
          {bio.length} / 500
        </p>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || !isUsernameValid}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-upvote px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "儲存中..." : "儲存個人資料"}
      </button>
    </form>
  );
}
