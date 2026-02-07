"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface AvatarFormProps {
  currentAvatarUrl: string | null;
  currentDisplayName: string;
}

export default function AvatarForm({ currentAvatarUrl, currentDisplayName }: AvatarFormProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const previewUrl = useMemo(() => avatarUrl.trim(), [avatarUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl }),
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
      <div className="flex items-center gap-3 rounded-xl border border-neutral bg-base-200 p-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-base-300 text-sm font-bold text-base-content">
          {previewUrl ? (
            <img src={previewUrl} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            currentDisplayName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-base-content">Avatar Preview</p>
          <p className="text-xs text-[#818384]">Paste image URL and save to update avatar.</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-base-content">Avatar URL</label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral bg-base-200 px-4 py-2.5 text-sm text-base-content outline-none transition-colors placeholder:text-[#818384] focus:border-base-content"
          placeholder="https://..."
          aria-label="Avatar URL"
        />
      </div>

      {status && <div className="text-sm text-[#818384]">{status}</div>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-content transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save avatar"}
      </button>
    </form>
  );
}
