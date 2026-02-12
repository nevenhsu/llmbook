"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

interface Board {
  id: string;
  name: string;
  slug: string;
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

type Tab = "text" | "media" | "poll";

export default function CreatePostForm({ boards, tags }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("text");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [boardId, setBoardId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState('3');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);

  // Initialize boardId when boards are available
  if (!boardId && boards.length > 0) {
    setBoardId(boards[0].id);
  }

  // Load drafts from localStorage on mount
  useEffect(() => {
    const savedDrafts = localStorage.getItem('post-drafts');
    if (savedDrafts) {
      try {
        setDrafts(JSON.parse(savedDrafts));
      } catch (e) {
        console.error('Failed to parse drafts:', e);
      }
    }
  }, []);

  function saveDraft() {
    const draft = {
      id: Date.now().toString(),
      title,
      body,
      boardId,
      tagIds,
      media,
      pollOptions,
      pollDuration,
      activeTab,
      savedAt: new Date().toISOString(),
    };

    const existingDrafts = drafts;
    const newDrafts = [draft, ...existingDrafts].slice(0, 10); // Keep max 10 drafts
    setDrafts(newDrafts);
    localStorage.setItem('post-drafts', JSON.stringify(newDrafts));
    alert('Draft saved!');
  }

  function loadDraft(draft: any) {
    setTitle(draft.title || '');
    setBody(draft.body || '');
    setBoardId(draft.boardId || (boards.length > 0 ? boards[0].id : ''));
    setTagIds(draft.tagIds || []);
    setMedia(draft.media || []);
    setPollOptions(draft.pollOptions || ['', '']);
    setPollDuration(draft.pollDuration || '3');
    setActiveTab(draft.activeTab || 'text');
    setShowDrafts(false);
    alert('Draft loaded!');
  }

  function deleteDraft(draftId: string) {
    const newDrafts = drafts.filter((d) => d.id !== draftId);
    setDrafts(newDrafts);
    localStorage.setItem('post-drafts', JSON.stringify(newDrafts));
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
      const postData: any = {
        title,
        boardId,
        tagIds,
        postType: activeTab === 'poll' ? 'poll' : activeTab === 'media' ? 'image' : 'text'
      };

      if (activeTab === 'text') {
        postData.body = body;
      }

      if (activeTab === 'media') {
        postData.mediaIds = media.map((m) => m.mediaId);
        postData.body = body || '';
      }

      if (activeTab === 'poll') {
        const validOptions = pollOptions.filter(opt => opt.trim());
        if (validOptions.length < 2) {
          throw new Error('Poll must have at least 2 options');
        }
        postData.pollOptions = validOptions.map(text => ({ text }));
        postData.pollDuration = parseInt(pollDuration, 10);
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Could not create post");
      }

      const data = await res.json();
      const selectedBoard = boards.find(b => b.id === boardId);
      if (selectedBoard) {
        router.push(`/r/${selectedBoard.slug}/posts/${data.id}`);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[740px] pb-20 sm:pb-10 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <h1 className="text-2xl font-bold text-base-content">Create post</h1>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDrafts(!showDrafts)}
            className="text-xs font-bold text-base-content uppercase tracking-wider hover:hover:bg-base-300 px-3 py-1.5 rounded transition-colors"
          >
            Drafts {drafts.length > 0 && `(${drafts.length})`}
          </button>

          {/* Drafts dropdown */}
          {showDrafts && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-md border border-neutral bg-base-100 shadow-xl z-50">
              {drafts.length === 0 ? (
                <p className="text-sm text-base-content/50 p-4">No drafts saved</p>
              ) : (
                <div className="p-2">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="p-3 rounded hover:hover:bg-base-300 border-b border-neutral last:border-0 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => loadDraft(draft)}
                          className="flex-1 text-left"
                        >
                          <p className="font-bold text-sm text-base-content line-clamp-1">
                            {draft.title || 'Untitled draft'}
                          </p>
                          <p className="text-xs text-base-content/50 mt-1">
                            {new Date(draft.savedAt).toLocaleString()}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDraft(draft.id)}
                          className="p-1 hover:hover:bg-error/20 rounded text-error transition-colors"
                          title="Delete draft"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Community Selector */}
      <div className="mb-6">
        <div className="inline-flex h-10 items-center gap-2 rounded-full border border-neutral bg-base-100 py-1 pl-1 pr-3 hover:hover:bg-base-300 cursor-pointer group relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-base-300">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 text-base-content"
            >
              <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm5.21 13.91a4.93 4.93 0 0 1-3.6 1.76c-2.3 0-3.8-1.57-3.8-1.57s-1.5 1.57-3.8 1.57a4.93 4.93 0 0 1-3.6-1.76 2.05 2.05 0 0 1-.36-2.5 5.56 5.56 0 0 1 3.52-2.58 3.32 3.32 0 0 1 .44-.29 3.86 3.86 0 0 1-1.09-2.73 3.61 3.61 0 1 1 5.95-2.15 3.62 3.62 0 1 1 5.97 2.14 3.86 3.86 0 0 1-1.1 2.73 3.32 3.32 0 0 1 .45.3 5.56 5.56 0 0 1 3.52 2.58 2.05 2.05 0 0 1-.36 2.5Z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-base-content">
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
            className="h-4 w-4 text-base-content"
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
          className="flex border-b border-neutral mb-6 overflow-x-auto scrollbar-hide"
        >
          {([
            { key: "text", label: "Text" },
            { key: "media", label: "Images & Video" },
            { key: "poll", label: "Poll" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "text-base-content border-primary"
                  : "text-base-content/70 border-transparent hover:text-base-content"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
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
                className="w-full rounded-[20px] border border-neutral bg-base-100 p-4 text-sm text-base-content placeholder-text-base-content/50 hover:border-neutral focus: focus:outline-none transition-colors"
              />
              {!title && (
                <span className="absolute left-[44px] top-[14.5px] pointer-events-none text-error text-sm">
                  *
                </span>
              )}
            </div>
            <div className="text-right text-xs text-base-content/70">
              {title.length}/300
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            {/* Selected tags */}
            {tagIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tagIds.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId);
                  return tag ? (
                    <div
                      key={tagId}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-primary/20 text-primary"
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => setTagIds(tagIds.filter((id) => id !== tagId))}
                        className="hover:hover:bg-primary/30 rounded-full p-0.5 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            
            {/* Add tags button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTagSelector(!showTagSelector)}
                className="px-4 py-1 text-xs font-bold rounded-full bg-base-300 text-base-content/70 hover:text-base-content transition-colors"
              >
                {tagIds.length > 0 ? 'Edit tags' : 'Add tags'}
              </button>
              
              {/* Tag selector dropdown */}
              {showTagSelector && (
                <div className="absolute left-0 top-full mt-2 w-64 max-h-64 overflow-y-auto rounded-md border border-neutral bg-base-100 shadow-xl z-50">
                  <div className="p-2">
                    {tags.length === 0 ? (
                      <p className="text-sm text-base-content/50 p-2">No tags available</p>
                    ) : (
                      tags.map((tag) => {
                        const isSelected = tagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setTagIds(tagIds.filter((id) => id !== tag.id));
                              } else {
                                setTagIds([...tagIds, tag.id]);
                              }
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:hover:bg-base-300 transition-colors ${
                              isSelected ? 'bg-primary/20 text-primary font-bold' : 'text-base-content'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-primary border-primary' : 'border-neutral'
                              }`}>
                                {isSelected && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 text-base-100"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                              {tag.name}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
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
              <div className="flex h-40 sm:h-64 w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-neutral bg-base-100 p-4 text-center">
                <p className="mb-2 text-base-content">
                  Drag and drop images or
                </p>
                <label className="cursor-pointer px-6 py-2 rounded-full border  text-base-content text-sm font-bold hover:bg-base-300 transition-colors">
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
                      className="relative h-16 w-16 overflow-hidden rounded bg-base-300"
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

            {activeTab === "poll" && (
              <div className="space-y-2">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className="w-full rounded-[20px] border border-neutral bg-base-100 p-3 text-sm text-base-content placeholder-text-base-content/50 hover:border-neutral focus: focus:outline-none transition-colors flex-1"
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[idx] = e.target.value;
                        setPollOptions(newOptions);
                      }}
                      maxLength={200}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        className="px-3 py-2 rounded-full hover:hover:bg-base-300 text-base-content/70 transition-colors"
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="px-6 py-2 rounded-full border  text-base-content text-sm font-bold hover:bg-base-300 transition-colors w-full mt-2"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  disabled={pollOptions.length >= 6}
                >
                  + Add Option
                </button>
                <select
                  className="w-full rounded-[20px] border border-neutral bg-base-100 p-3 text-sm text-base-content focus: focus:outline-none transition-colors mt-4"
                  value={pollDuration}
                  onChange={(e) => setPollDuration(e.target.value)}
                >
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">1 week</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Fixed on mobile, relative on desktop */}
        <div className="fixed bottom-[64px] left-0 right-0 z-[101] flex justify-end gap-2 border-t border-neutral bg-base-200/95 p-3 backdrop-blur sm:relative sm:bottom-0 sm:z-40 sm:border-0 sm:p-0 sm:bg-transparent sm:mt-8 sm:backdrop-blur-none">
          <button
            type="button"
            onClick={saveDraft}
            className="px-6 py-2 rounded-full text-base-content/70 font-bold text-sm hover:bg-base-100 transition-colors"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title || !boardId || loading}
            className="px-8 py-2 rounded-full bg-base-content text-base-100 text-sm font-bold hover:bg-opacity-90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded bg-error/20/20 p-3 text-sm text-error border border-error/30">
          {error}
        </div>
      )}
    </div>
  );
}
