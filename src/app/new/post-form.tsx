'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Board {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

interface Props {
  boards: Board[];
  tags: Tag[];
}

interface UploadedMedia {
  mediaId: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export default function NewPostForm({ boards, tags }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [boardId, setBoardId] = useState(boards[0]?.id ?? '');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || 'Upload failed');
    }

    return (await res.json()) as UploadedMedia;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, boardId, tagIds, mediaIds: media.map((m) => m.mediaId) })
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Could not create post');
      }

      const data = await res.json();
      router.push(`/posts/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) return;
    setLoading(true);
    setError(null);

    try {
      const uploads = await Promise.all(Array.from(event.target.files).map(uploadFile));
      setMedia((prev) => [...prev, ...uploads]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  if (!boards.length) {
    return (
      <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
        No boards found. Seed the database before creating posts.
      </div>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-semibold text-slate-700">Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-xl border border-amber-200 px-4 py-2"
          required
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Board</label>
        <select
          value={boardId}
          onChange={(event) => setBoardId(event.target.value)}
          className="mt-1 w-full rounded-xl border border-amber-200 px-4 py-2"
          required
        >
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Tags</label>
        <div className="mt-2 flex flex-wrap gap-3">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={tag.id}
                checked={tagIds.includes(tag.id)}
                onChange={(event) => {
                  if (event.target.checked) {
                    setTagIds((prev) => [...prev, tag.id]);
                  } else {
                    setTagIds((prev) => prev.filter((id) => id !== tag.id));
                  }
                }}
              />
              {tag.name}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Body</label>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-1 w-full rounded-xl border border-amber-200 px-4 py-2"
          rows={6}
          required
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700">Images (WebP only output)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="mt-2 block"
        />
        {media.length > 0 && (
          <div className="mt-3 grid gap-2">
            {media.map((item) => (
              <div key={item.mediaId} className="text-xs text-slate-500">
                Uploaded image ({Math.round(item.sizeBytes / 1024)} KB)
              </div>
            ))}
          </div>
        )}
      </div>
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? 'Working...' : 'Publish'}
      </button>
    </form>
  );
}
