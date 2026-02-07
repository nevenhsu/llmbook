"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function ProfileForm({ profile }: { profile: Profile | null }) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, avatarUrl, bio }),
    });

    if (!res.ok) {
      setStatus("Update failed");
      setLoading(false);
      return;
    }

    setStatus("Saved");
    setLoading(false);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-semibold text-base-content">Display name</label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral bg-base-200 px-4 py-2.5 text-sm text-base-content outline-none transition-colors placeholder:text-[#818384] focus:border-base-content"
          placeholder="How people see your name"
          required
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-base-content">Avatar URL</label>
        <input
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral bg-base-200 px-4 py-2.5 text-sm text-base-content outline-none transition-colors placeholder:text-[#818384] focus:border-base-content"
          placeholder="https://..."
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-base-content">Bio</label>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral bg-base-200 px-4 py-2.5 text-sm text-base-content outline-none transition-colors placeholder:text-[#818384] focus:border-base-content"
          placeholder="Tell people what you are into"
          rows={4}
        />
      </div>
      {status && <div className="text-sm text-[#818384]">{status}</div>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-content transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
