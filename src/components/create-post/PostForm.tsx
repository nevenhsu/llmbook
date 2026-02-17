"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import TagSelector from "@/components/tags/TagSelector";
import BoardSelector from "@/components/boards/BoardSelector";
import toast from "react-hot-toast";

interface Board {
  id: string;
  name: string;
  slug: string;
}

interface PollOption {
  id: string;
  option_text: string;
  vote_count: number;
}

interface InitialData {
  postId: string;
  title: string;
  body: string;
  boardId: string;
  boardSlug: string;
  boardName?: string;
  tagIds: string[];
  postType: "TEXT" | "POLL";
  pollOptions?: PollOption[];
  pollDuration?: string;
}

interface Props {
  userJoinedBoards: Board[];
  editMode?: boolean;
  initialData?: InitialData;
}

interface UploadedMedia {
  mediaId: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

type Tab = "text" | "poll";

export default function PostForm({
  userJoinedBoards,
  editMode = false,
  initialData,
}: Props) {
  const router = useRouter();

  // Determine initial tab based on post type in edit mode
  const getInitialTab = (): Tab => {
    if (editMode && initialData) {
      if (initialData.postType === "POLL") return "poll";
    }
    return "text";
  };

  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab());

  const [title, setTitle] = useState(initialData?.title || "");
  const [body, setBody] = useState(initialData?.body || "");
  const [boardId, setBoardId] = useState(initialData?.boardId || "");
  const [tagIds, setTagIds] = useState<string[]>(initialData?.tagIds || []);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  
  // Initialize selectedBoard
  const getInitialBoard = (): Board | null => {
    if (editMode && initialData) {
      // In edit mode, use initialData board info
      return {
        id: initialData.boardId,
        name: initialData.boardName || initialData.boardSlug,
        slug: initialData.boardSlug,
      };
    }
    // In create mode, find from userJoinedBoards
    return userJoinedBoards.find((b) => b.id === boardId) || null;
  };
  
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(getInitialBoard());
  // Store pending images to upload when post button is clicked
  const [pendingImages, setPendingImages] = useState<Map<string, File>>(
    new Map(),
  );
  const [pollOptions, setPollOptions] = useState<string[]>(
    initialData?.pollOptions?.map((opt) => opt.option_text) || ["", ""],
  );
  const [newPollOptions, setNewPollOptions] = useState<string[]>([""]); // For edit mode: new options to add
  const [pollDuration, setPollDuration] = useState(
    initialData?.pollDuration || "3",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);

  // Initialize boardId when userJoinedBoards are available
  if (!boardId && userJoinedBoards.length > 0) {
    setBoardId(userJoinedBoards[0].id);
  }



  // Load drafts from localStorage on mount
  useEffect(() => {
    const draftKey =
      editMode && initialData
        ? `post-edit-draft-${initialData.postId}`
        : "post-drafts";

    if (editMode && initialData) {
      // Load single edit draft
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          setTitle(draft.title || title);
          setBody(draft.body || body);
          setTagIds(draft.tagIds || tagIds);
          if (draft.newPollOptions) {
            setNewPollOptions(draft.newPollOptions);
          }
        } catch (e) {
          console.error("Failed to parse edit draft:", e);
        }
      }
    } else {
      // Load multiple create drafts
      const savedDrafts = localStorage.getItem(draftKey);
      if (savedDrafts) {
        try {
          setDrafts(JSON.parse(savedDrafts));
        } catch (e) {
          console.error("Failed to parse drafts:", e);
        }
      }
    }
  }, [editMode, initialData]);

  function saveDraft() {
    if (editMode && initialData) {
      // Save edit draft
      const draft = {
        title,
        body,
        tagIds,
        newPollOptions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        `post-edit-draft-${initialData.postId}`,
        JSON.stringify(draft),
      );
      toast.success("Draft saved!");
    } else {
      // Save create draft
      const draft = {
        id: Date.now().toString(),
        title,
        body,
        boardId,
        tagIds,
        pollOptions,
        pollDuration,
        activeTab,
        savedAt: new Date().toISOString(),
      };

      const existingDrafts = drafts;
      const newDrafts = [draft, ...existingDrafts].slice(0, 10); // Keep max 10 drafts
      setDrafts(newDrafts);
      localStorage.setItem("post-drafts", JSON.stringify(newDrafts));
      toast.success("Draft saved!");
    }
  }

  function loadDraft(draft: any) {
    setTitle(draft.title || "");
    setBody(draft.body || "");
    setBoardId(draft.boardId || (userJoinedBoards.length > 0 ? userJoinedBoards[0].id : ""));
    setTagIds(draft.tagIds || []);
    setPollOptions(draft.pollOptions || ["", ""]);
    setPollDuration(draft.pollDuration || "3");
    setActiveTab(draft.activeTab || "text");
    setShowDrafts(false);
    toast.success("Draft loaded!");
  }

  function deleteDraft(draftId: string) {
    const newDrafts = drafts.filter((d) => d.id !== draftId);
    setDrafts(newDrafts);
    localStorage.setItem("post-drafts", JSON.stringify(newDrafts));
  }

  // Store image temporarily and return data URL for preview
  async function handleImageUpload(file: File): Promise<{ url: string }> {
    // Create data URL for immediate preview
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Store the file with data URL as key to upload later
    setPendingImages((prev) => new Map(prev).set(dataUrl, file));

    // Return data URL for preview (will be replaced with real URL on submit)
    return { url: dataUrl };
  }

  // Actually upload an image file
  async function uploadImageFile(file: File): Promise<string> {
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

    const data = (await res.json()) as UploadedMedia;
    return data.url;
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    
    // Show progress if there are images OR always show during submit
    const hasImages = activeTab === "text" && pendingImages.size > 0;
    if (hasImages) {
      setShowUploadProgress(true);
    }

    try {
      let finalBody = body;

      // Upload all pending images and replace data URLs with real URLs
      if (hasImages) {
        console.log(`Uploading ${pendingImages.size} images...`);

        for (const [dataUrl, file] of pendingImages.entries()) {
          try {
            console.log(`Uploading image: ${file.name}, size: ${file.size}`);
            const realUrl = await uploadImageFile(file);
            console.log(`Upload successful, real URL: ${realUrl}`);
            // Replace data URL with real URL in the body
            finalBody = finalBody.replace(dataUrl, realUrl);
          } catch (uploadError) {
            console.error('Image upload failed:', uploadError);
            setShowUploadProgress(false);
            throw new Error(
              `Failed to upload image: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
            );
          }
        }
        // Clear pending images after successful upload
        setPendingImages(new Map());
        console.log('All images uploaded successfully');
        // Keep progress bar showing until post is created
      }

      if (editMode && initialData) {
        // Edit mode: PATCH request
        const updateData: any = {
          title,
          body: finalBody,
          tagIds,
        };

        // Add new poll options if in poll edit mode
        if (activeTab === "poll") {
          const validNewOptions = newPollOptions.filter((opt) => opt.trim());
          if (validNewOptions.length > 0) {
            updateData.newPollOptions = validNewOptions;
          }
        }

        const res = await fetch(`/api/posts/${initialData.postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Could not update post");
        }

        // Clear edit draft from localStorage
        localStorage.removeItem(`post-edit-draft-${initialData.postId}`);

        // Redirect to post
        router.push(`/r/${initialData.boardSlug}/posts/${initialData.postId}`);
      } else {
        // Create mode: POST request
        const postData: any = {
          title,
          boardId,
          tagIds,
          postType: activeTab === "poll" ? "poll" : "text",
        };

        if (activeTab === "text") {
          postData.body = finalBody;
        }

        if (activeTab === "poll") {
          const validOptions = pollOptions.filter((opt) => opt.trim());
          if (validOptions.length < 2) {
            throw new Error("Poll must have at least 2 options");
          }
          postData.pollOptions = validOptions.map((text) => ({ text }));
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
        console.log('Post created:', data);
        console.log('Selected boardId:', boardId);
        
        // Use boardSlug from API response, fallback to selectedBoard
        const boardSlug = data.boardSlug || selectedBoard?.slug;
        console.log('Board slug for redirect:', boardSlug);
        
        if (boardSlug) {
          const redirectUrl = `/r/${boardSlug}/posts/${data.id}`;
          console.log('Redirecting to:', redirectUrl);
          // Progress bar will disappear on navigation
          router.push(redirectUrl);
        } else {
          console.error('No board slug found, redirecting to home');
          setShowUploadProgress(false);
          router.push("/");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setShowUploadProgress(false);
    }
  }

  return (
    <div className="mx-auto max-w-[740px] pb-20 sm:pb-10 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <h1 className="text-2xl font-bold text-base-content">
          {editMode ? "Edit post" : "Create post"}
        </h1>
      </div>

      {/* Community Selector */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => !editMode && setShowBoardSelector(true)}
          disabled={editMode}
          className={`inline-flex h-10 items-center gap-2 rounded-full border border-neutral bg-base-100 py-1 pl-1 pr-3 ${editMode ? "opacity-60 cursor-not-allowed" : "hover:bg-base-300 cursor-pointer"}`}
        >
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
            {selectedBoard?.name
              ? `r/${selectedBoard.name}`
              : "Select a community"}
          </span>
          {!editMode && (
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
          )}
        </button>

        <BoardSelector
          isOpen={showBoardSelector}
          onClose={() => setShowBoardSelector(false)}
          selectedBoardId={boardId}
          selectedBoard={selectedBoard}
          onBoardSelect={(id, board) => {
            setBoardId(id);
            setSelectedBoard(board);
          }}
          userJoinedBoards={userJoinedBoards}
        />

        {editMode && (
          <p className="text-xs text-base-content/50 mt-2">
            Community cannot be changed after posting
          </p>
        )}
      </div>

      {/* Main Form Area */}
      <div>
        {/* Tabs - DaisyUI standard style structure but with custom buttons */}
        <div
          role="tablist"
          className="flex border-b border-neutral mb-6 overflow-x-auto scrollbar-hide"
        >
          {(
            [
              { key: "text", label: "Text" },
              { key: "poll", label: "Poll" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              disabled={editMode}
              className={`px-6 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "text-base-content border-primary"
                  : "text-base-content/70 border-transparent hover:text-base-content"
              } ${editMode ? "cursor-not-allowed opacity-60" : ""}`}
              onClick={() => !editMode && setActiveTab(tab.key)}
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
                className="input input-bordered w-full"
              />
              {!title && (
                <span className="absolute left-[52px] top-1/2 -translate-y-1/2 pointer-events-none text-error text-sm">
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
            <button
              type="button"
              onClick={() => setShowTagSelector(true)}
              className="btn btn-outline"
            >
              {tagIds.length > 0 ? `已選擇 ${tagIds.length} 個標籤` : "選擇標籤"}
            </button>

            <TagSelector
              isOpen={showTagSelector}
              onClose={() => setShowTagSelector(false)}
              selectedTagIds={tagIds}
              onTagsChange={setTagIds}
            />
          </div>

          {/* Body / Editor */}
          <div>
            {activeTab === "text" && (
              <SimpleEditor
                content={body}
                onChange={setBody}
                placeholder="Body text (optional)"
                onImageUpload={handleImageUpload}
              />
            )}

            {activeTab === "poll" && (
              <div className="space-y-2">
                {editMode ? (
                  <>
                    {/* Existing poll options (read-only) */}
                    {pollOptions.map((opt, idx) => (
                      <div key={`existing-${idx}`} className="flex gap-2">
                        <input
                          className="input input-bordered flex-1 cursor-not-allowed"
                          value={opt}
                          readOnly
                          disabled
                        />
                        <div className="px-3 py-2 rounded-full text-base-content/50 flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                      </div>
                    ))}

                    {/* Separator */}
                    {newPollOptions.length > 0 && pollOptions.length > 0 && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="flex-1 border-t border-neutral"></div>
                        <span className="text-xs text-base-content/50 font-semibold">
                          New Options
                        </span>
                        <div className="flex-1 border-t border-neutral"></div>
                      </div>
                    )}

                    {/* New poll options (editable) */}
                    {newPollOptions.map((opt, idx) => (
                      <div key={`new-${idx}`} className="flex gap-2">
                        <input
                          className="input input-bordered flex-1"
                          placeholder={`New option ${idx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...newPollOptions];
                            newOpts[idx] = e.target.value;
                            setNewPollOptions(newOpts);
                          }}
                          maxLength={200}
                        />
                        {newPollOptions.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={() =>
                              setNewPollOptions(
                                newPollOptions.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
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
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      className="btn btn-outline btn-sm w-full mt-2"
                      onClick={() => setNewPollOptions([...newPollOptions, ""])}
                      disabled={pollOptions.length + newPollOptions.length >= 6}
                    >
                      + Add New Option
                    </button>

                    <p className="text-xs text-base-content/50 mt-2">
                      Existing poll options cannot be removed or edited. You can
                      only add new options.
                    </p>
                  </>
                ) : (
                  <>
                    {/* Create mode: all options are editable */}
                    {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          className="input input-bordered flex-1"
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
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={() =>
                              setPollOptions(
                                pollOptions.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
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
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm w-full mt-2"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      disabled={pollOptions.length >= 6}
                    >
                      + Add Option
                    </button>
                    <select
                      className="select select-bordered w-full mt-4"
                      value={pollDuration}
                      onChange={(e) => setPollDuration(e.target.value)}
                    >
                      <option value="1">1 day</option>
                      <option value="3">3 days</option>
                      <option value="7">1 week</option>
                    </select>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Fixed to bottom 0 on mobile, relative on desktop */}
        <div className="fixed bottom-0 left-0 right-0 z-[101] flex justify-between items-center gap-2 border-t border-neutral bg-base-200/95 p-3 backdrop-blur sm:relative sm:bottom-0 sm:z-40 sm:border-0 sm:p-0 sm:bg-transparent sm:mt-8 sm:backdrop-blur-none sm:justify-end">
          {/* Drafts button on left (mobile & desktop) */}
          {!editMode && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDrafts(!showDrafts)}
                className="btn btn-ghost btn-sm"
              >
                Drafts {drafts.length > 0 && `(${drafts.length})`}
              </button>

              {/* Drafts dropdown */}
              {showDrafts && (
                <div className="absolute left-0 bottom-full mb-2 w-80 max-h-96 overflow-y-auto rounded-md border border-neutral bg-base-100 shadow-xl z-[110]">
                  {drafts.length === 0 ? (
                    <p className="text-sm text-base-content/50 p-4">
                      No drafts saved
                    </p>
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
                                {draft.title || "Untitled draft"}
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
          )}

          {/* Right side: Save Draft + Post buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="btn btn-ghost btn-sm"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !title ||
                !boardId ||
                loading
              }
              className="btn btn-primary btn-sm"
            >
              {loading && (
                <span className="loading loading-spinner loading-xs"></span>
              )}
              {loading
                ? editMode
                  ? "Updating..."
                  : "Posting..."
                : editMode
                  ? "Update"
                  : "Post"}
            </button>
          </div>
        </div>
      </div>

      {/* Upload Progress Indicator */}
      {showUploadProgress && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-neutral bg-base-100 p-6 shadow-xl">
            <progress className="progress progress-primary w-full"></progress>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded bg-error/20 p-3 text-sm text-error border border-error/30">
          {error}
        </div>
      )}
    </div>
  );
}
