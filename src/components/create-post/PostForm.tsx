"use client";

import { useState } from "react";
import TagSelector from "@/components/tags/TagSelector";
import BoardSelector from "@/components/boards/BoardSelector";
import TextEditor from "./editors/TextEditor";
import PollEditor from "./editors/PollEditor";
import { usePostForm } from "./hooks/usePostForm";
import type { Board, InitialData } from "./types";
import { Trash2 } from "lucide-react";

interface Props {
  userJoinedBoards?: Board[];
  editMode?: boolean;
  initialData?: InitialData;
}

export default function PostForm({ userJoinedBoards = [], editMode = false, initialData }: Props) {
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showBoardSelector, setShowBoardSelector] = useState(false);

  const form = usePostForm({ editMode, initialData, userJoinedBoards });

  return (
    <div className="mx-auto max-w-[740px] px-4 pb-20 sm:px-0 sm:pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <h1 className="text-base-content text-2xl font-bold">
          {editMode ? "Edit post" : "Create post"}
        </h1>
      </div>

      {/* Board Selector */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => !editMode && setShowBoardSelector(true)}
          disabled={editMode}
          className={`border-neutral bg-base-100 inline-flex h-10 items-center gap-2 rounded-full border py-1 pr-3 pl-1 ${
            editMode ? "cursor-not-allowed opacity-60" : "hover:bg-base-300 cursor-pointer"
          }`}
        >
          <div className="bg-base-300 flex h-8 w-8 items-center justify-center rounded-full">
            <svg viewBox="0 0 20 20" fill="currentColor" className="text-base-content h-5 w-5">
              <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm5.21 13.91a4.93 4.93 0 0 1-3.6 1.76c-2.3 0-3.8-1.57-3.8-1.57s-1.5 1.57-3.8 1.57a4.93 4.93 0 0 1-3.6-1.76 2.05 2.05 0 0 1-.36-2.5 5.56 5.56 0 0 1 3.52-2.58 3.32 3.32 0 0 1 .44-.29 3.86 3.86 0 0 1-1.09-2.73 3.61 3.61 0 1 1 5.95-2.15 3.62 3.62 0 1 1 5.97 2.14 3.86 3.86 0 0 1-1.1 2.73 3.32 3.32 0 0 1 .45.3 5.56 5.56 0 0 1 3.52 2.58 2.05 2.05 0 0 1-.36 2.5Z" />
            </svg>
          </div>
          <span className="text-base-content text-sm font-bold">
            {form.selectedBoard?.name ? `r/${form.selectedBoard.name}` : "Select a community"}
          </span>
          {!editMode && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="text-base-content h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          )}
        </button>

        <BoardSelector
          isOpen={showBoardSelector}
          onClose={() => setShowBoardSelector(false)}
          selectedBoardId={form.boardId}
          selectedBoard={form.selectedBoard}
          onBoardSelect={(id, board) => {
            form.setBoardId(id);
            form.setSelectedBoard(board);
          }}
          userJoinedBoards={userJoinedBoards ?? []}
        />

        {editMode && (
          <p className="text-base-content/50 mt-2 text-xs">
            Community cannot be changed after posting
          </p>
        )}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="border-neutral scrollbar-hide mb-6 flex overflow-x-auto border-b"
      >
        {(["text", "poll"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            disabled={editMode}
            className={`border-b-2 px-6 py-3 text-sm font-bold whitespace-nowrap capitalize transition-colors ${
              form.activeTab === tab
                ? "text-base-content border-primary"
                : "text-base-content/70 hover:text-base-content border-transparent"
            } ${editMode ? "cursor-not-allowed opacity-60" : ""}`}
            onClick={() => !editMode && form.setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Form body */}
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={form.title}
              onChange={(e) => form.setTitle(e.target.value)}
              placeholder="Title"
              maxLength={300}
              className="input input-bordered w-full"
            />
            {!form.title && (
              <span className="text-error pointer-events-none absolute top-1/2 left-[52px] -translate-y-1/2 text-sm">
                *
              </span>
            )}
          </div>
          <div className="text-base-content/70 text-right text-xs">{form.title.length}/300</div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowTagSelector(true)}
            className="btn btn-outline"
          >
            {form.tagIds.length > 0 ? `已選擇 ${form.tagIds.length} 個標籤` : "選擇標籤"}
          </button>
          <TagSelector
            isOpen={showTagSelector}
            onClose={() => setShowTagSelector(false)}
            selectedTagIds={form.tagIds}
            onTagsChange={form.setTagIds}
          />
        </div>

        {/* Editor */}
        {form.activeTab === "text" && (
          <TextEditor
            body={form.body}
            onChange={form.setBody}
            onImageUpload={form.handleImageUpload}
          />
        )}

        {form.activeTab === "poll" &&
          (editMode ? (
            <PollEditor
              editMode={true}
              existingOptions={form.pollOptions}
              newOptions={form.newPollOptions}
              onNewOptionsChange={form.setNewPollOptions}
            />
          ) : (
            <PollEditor
              editMode={false}
              options={form.pollOptions}
              duration={form.pollDuration}
              onOptionsChange={form.setPollOptions}
              onDurationChange={form.setPollDuration}
            />
          ))}
      </div>

      {/* Footer */}
      <div className="border-neutral bg-base-200/95 fixed right-0 bottom-0 left-0 z-[101] flex items-center justify-between gap-2 border-t p-3 backdrop-blur sm:relative sm:bottom-0 sm:z-40 sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {/* Left: Drafts */}
        <div className="dropdown dropdown-top">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
            Drafts {!editMode && form.drafts.length > 0 && `(${form.drafts.length})`}
          </div>

          <div className="dropdown-content border-neutral bg-base-100 z-[110] mb-2 max-h-96 w-80 overflow-y-auto rounded-md border shadow-xl">
            {editMode ? (
              form.editDraftSavedAt ? (
                <div className="p-2">
                  <div className="border-neutral rounded p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          form.loadEditDraft();
                          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                        }}
                        className="flex-1 text-left"
                      >
                        <p className="text-base-content line-clamp-1 text-sm font-bold">
                          {form.title || "Untitled draft"}
                        </p>
                        <p className="text-base-content/50 mt-1 text-xs">
                          {new Date(form.editDraftSavedAt).toLocaleString()}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          form.deleteEditDraft();
                          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                        }}
                        className="hover:bg-error/20 text-error rounded p-1 transition-colors"
                        title="Delete draft"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-base-content/50 p-4 text-sm">No draft saved</p>
              )
            ) : form.drafts.length === 0 ? (
              <p className="text-base-content/50 p-4 text-sm">No drafts saved</p>
            ) : (
              <div className="p-2">
                {form.drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="hover:bg-base-300 border-neutral rounded border-b p-3 transition-colors last:border-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          form.loadCreateDraft(draft);
                          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                        }}
                        className="flex-1 text-left"
                      >
                        <p className="text-base-content line-clamp-1 text-sm font-bold">
                          {draft.title || "Untitled draft"}
                        </p>
                        <p className="text-base-content/50 mt-1 text-xs">
                          {new Date(draft.savedAt).toLocaleString()}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => form.deleteCreateDraft(draft.id)}
                        className="hover:bg-error/20 text-error rounded p-1 transition-colors"
                        title="Delete draft"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Save Draft + Submit */}
        <div className="flex gap-2">
          <button type="button" onClick={form.saveDraft} className="btn btn-ghost btn-sm">
            Save Draft
          </button>
          <button
            type="button"
            onClick={form.handleSubmit}
            disabled={!form.title || !form.boardId || form.loading}
            className="btn btn-primary btn-sm"
          >
            {form.loading && <span className="loading loading-spinner loading-xs" />}
            {form.loading
              ? editMode
                ? "Updating..."
                : "Posting..."
              : editMode
                ? "Update"
                : "Post"}
          </button>
        </div>
      </div>

      {/* Upload progress overlay */}
      {form.showUploadProgress && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="border-neutral bg-base-100 w-full max-w-md rounded-lg border p-6 shadow-xl">
            <progress className="progress progress-primary w-full" />
          </div>
        </div>
      )}

      {/* Error */}
      {form.error && (
        <div className="bg-error/20 text-error border-error/30 mt-4 rounded border p-3 text-sm">
          {form.error}
        </div>
      )}
    </div>
  );
}
