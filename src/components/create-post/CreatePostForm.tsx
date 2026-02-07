"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

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

type Tab = "text" | "media" | "link" | "poll";

export default function CreatePostForm({ boards, tags }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("text");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [boardId, setBoardId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize boardId when boards are available
  if (!boardId && boards.length > 0) {
    setBoardId(boards[0].id);
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || "Upload failed");
    }

    return (await res.json()) as UploadedMedia;
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          boardId,
          tagIds,
          mediaIds: media.map((m) => m.mediaId),
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Could not create post");
      }

      const data = await res.json();
      router.push(`/posts/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[740px] pb-20 sm:pb-10 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <h1 className="text-2xl font-bold text-text-primary">Create post</h1>
        <button className="text-xs font-bold text-text-primary hover:underline uppercase tracking-wider">
          Drafts
        </button>
      </div>

      {/* Community Selector */}
      <div className="mb-6">
        <div className="inline-flex h-10 items-center gap-2 rounded-full border border-border-default bg-surface py-1 pl-1 pr-3 hover:bg-surface-hover cursor-pointer group relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-text-primary"
            >
              <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm5.21 13.91a4.93 4.93 0 0 1-3.6 1.76c-2.3 0-3.8-1.57-3.8-1.57s-1.5 1.57-3.8 1.57a4.93 4.93 0 0 1-3.6-1.76 2.05 2.05 0 0 1-.36-2.5 5.56 5.56 0 0 1 3.52-2.58 3.32 3.32 0 0 1 .44-.29 3.86 3.86 0 0 1-1.09-2.73 3.61 3.61 0 1 1 5.95-2.15 3.62 3.62 0 1 1 5.97 2.14 3.86 3.86 0 0 1-1.1 2.73 3.32 3.32 0 0 1 .45.3 5.56 5.56 0 0 1 3.52 2.58 2.05 2.05 0 0 1-.36 2.5Z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-text-primary">
            {boards.find((b) => b.id === boardId)?.name
              ? `r/${boards.find((b) => b.id === boardId)?.name}`
              : "Select a community"}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="h-4 w-4 text-text-primary"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>

          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          >
            <option value="" disabled>
              Select a community
            </option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                r/{board.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Form Area */}
      <div>
        {/* Tabs - DaisyUI standard style structure but with custom buttons */}
        <div
          role="tablist"
          className="flex border-b border-border-default mb-6 overflow-x-auto scrollbar-hide"
        >
          {([
            { key: "text", label: "Text" },
            { key: "media", label: "Images & Video" },
            { key: "link", label: "Link" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "text-text-primary border-upvote"
                  : "text-text-secondary border-transparent hover:text-text-primary"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
          <button
            role="tab"
            className="px-6 py-3 text-sm font-bold whitespace-nowrap opacity-50 cursor-not-allowed text-text-secondary border-transparent"
            disabled
          >
            Poll
          </button>
        </div>

        {/* Content Area */}
        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                maxLength={300}
                className="w-full rounded-[20px] border border-border-default bg-surface p-4 text-sm text-text-primary placeholder-text-muted hover:border-border-hover focus:border-text-primary focus:outline-none transition-colors"
              />
              {!title && (
                <span className="absolute left-[44px] top-[14.5px] pointer-events-none text-upvote text-sm">
                  *
                </span>
              )}
            </div>
            <div className="text-right text-xs text-text-secondary">
              {title.length}/300
            </div>
          </div>

          {/* Tags Placeholder */}
          <div>
            <button className="px-4 py-1 text-xs font-bold rounded-full bg-highlight text-text-secondary hover:text-text-primary transition-colors">
              Add tags
            </button>
          </div>

          {/* Body / Editor */}
          <div>
            {activeTab === "text" && (
              <SimpleEditor
                content={body}
                onChange={setBody}
                placeholder="Body text (optional)"
              />
            )}

            {activeTab === "media" && (
              <div className="flex h-40 sm:h-64 w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-border-default bg-surface p-4 text-center">
                <p className="mb-2 text-text-primary">
                  Drag and drop images or
                </p>
                <label className="cursor-pointer px-6 py-2 rounded-full border border-text-primary text-text-primary text-sm font-bold hover:bg-highlight transition-colors">
                  Upload
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={async (e) => {
                      if (e.target.files) {
                        const files = Array.from(e.target.files);
                        for (const file of files) {
                          try {
                            const uploaded = await uploadFile(file);
                            setMedia((prev) => [...prev, uploaded]);
                          } catch (err) {
                            console.error(err);
                            setError("Failed to upload image");
                          }
                        }
                      }
                    }}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  {media.map((m) => (
                    <div
                      key={m.mediaId}
                      className="relative h-16 w-16 overflow-hidden rounded bg-highlight"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.url}
                        alt="Uploaded"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "link" && (
              <input
                type="text"
                placeholder="Url"
                className="w-full rounded-[20px] border border-border-default bg-surface p-4 text-sm text-text-primary placeholder-text-muted focus:border-text-primary focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Footer Actions - Fixed on mobile, relative on desktop */}
        <div className="fixed bottom-[64px] left-0 right-0 z-[101] flex justify-end gap-2 border-t border-border-default bg-canvas/95 p-3 backdrop-blur sm:relative sm:bottom-0 sm:z-40 sm:border-0 sm:p-0 sm:bg-transparent sm:mt-8 sm:backdrop-blur-none">
          <button type="button" className="px-6 py-2 rounded-full text-text-secondary font-bold text-sm hover:bg-surface transition-colors">
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title || !boardId || loading}
            className="px-8 py-2 rounded-full bg-text-primary text-canvas text-sm font-bold hover:bg-opacity-90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded bg-red-900/20 p-3 text-sm text-red-400 border border-red-500/30">
          {error}
        </div>
      )}
    </div>
  );
}
