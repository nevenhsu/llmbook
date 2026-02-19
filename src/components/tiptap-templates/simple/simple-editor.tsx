"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { MentionExtension } from "@/components/tiptap-extensions/mention";
import {
  Bold,
  ChevronDown,
  Code,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

export interface SimpleEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  onImageUpload?: (file: File) => Promise<{ url: string }>;
}

function isProbablySafeHttpUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`hover:hover:bg-base-300 rounded p-1.5 transition-colors ${active ? "bg-base-300 text-base-content" : "text-base-content/70 hover:text-base-content"}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function MenuBar({
  editor,
  onOpenLinkModal,
  onOpenImageModal,
}: {
  editor: Editor;
  onOpenLinkModal: () => void;
  onOpenImageModal: () => void;
}) {
  const headingLevels = [1, 2, 3] as const;

  return (
    <div className="border-neutral bg-base-100/60 relative z-50 flex flex-wrap items-center gap-0.5 overflow-visible border-b px-2 py-1 backdrop-blur-sm">
      <ToolbarButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
      >
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
      >
        <Redo2 size={16} />
      </ToolbarButton>

      <div className="bg-neutral mx-1 h-6 w-px" />

      <div className="dropdown dropdown-bottom">
        <button
          type="button"
          tabIndex={0}
          className="hover:hover:bg-base-300 text-base-content/70 hover:text-base-content flex items-center gap-1 rounded p-1.5 transition-colors"
          aria-label="Text style"
          title="Text style"
        >
          <span className="text-xs font-bold tracking-wider uppercase">Text</span>
          <ChevronDown size={14} />
        </button>
        <ul
          tabIndex={-1}
          className="dropdown-content border-neutral bg-base-100 absolute left-0 z-[110] mt-1 w-44 rounded-md border p-1 shadow-xl"
        >
          <li>
            <button
              type="button"
              className={`hover:hover:bg-base-300 w-full rounded px-3 py-2 text-left text-sm ${editor.isActive("paragraph") ? "bg-base-300 text-base-content" : "text-base-content/70"}`}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              Paragraph
            </button>
          </li>
          {headingLevels.map((level) => (
            <li key={level}>
              <button
                type="button"
                className={`hover:hover:bg-base-300 w-full rounded px-3 py-2 text-left text-sm ${editor.isActive("heading", { level }) ? "bg-base-300 text-base-content" : "text-base-content/70"}`}
                onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
              >
                Heading {level}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ToolbarButton
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
      >
        <Strikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
      >
        <Code size={16} />
      </ToolbarButton>

      <ToolbarButton
        label="Bulleted list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Blockquote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
      >
        <Quote size={16} />
      </ToolbarButton>

      <div className="bg-neutral mx-1 h-6 w-px" />

      <ToolbarButton
        label="Add or edit link"
        onClick={onOpenLinkModal}
        active={editor.isActive("link")}
      >
        <Link2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Remove link"
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
      >
        <Link2Off size={16} />
      </ToolbarButton>
      <ToolbarButton label="Insert image" onClick={onOpenImageModal}>
        <ImagePlus size={16} />
      </ToolbarButton>
    </div>
  );
}

export function SimpleEditor({ content, onChange, placeholder, onImageUpload }: SimpleEditorProps) {
  const [internalContent, setInternalContent] = useState<string>(content ?? "");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const effectiveContent = content ?? internalContent;
  const emitChange = useMemo(() => {
    return (next: string) => {
      if (onChange) onChange(next);
      if (content === undefined) setInternalContent(next);
    };
  }, [content, onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable link from StarterKit if it exists to avoid duplicates
        link: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || "Text (optional)",
        emptyEditorClass:
          "is-editor-empty before:text-base-content/50 before:content-[attr(data-placeholder)] before:float-left before:pointer-events-none before:h-0",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        allowBase64: true,
      }),
      MentionExtension,
    ],
    content: effectiveContent,
    onUpdate: ({ editor }) => {
      emitChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none p-4 min-h-[250px] sm:min-h-[200px] focus:outline-none text-sm leading-relaxed text-base-content",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (effectiveContent === editor.getHTML()) return;
    editor.commands.setContent(effectiveContent, { emitUpdate: false });
  }, [effectiveContent, editor]);

  function handleOpenLinkModal() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previousUrl ?? "");
    setShowLinkModal(true);
  }

  function handleSetLink() {
    if (!editor) return;
    const trimmed = linkUrl.trim();

    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setShowLinkModal(false);
      setLinkUrl("");
      return;
    }

    if (!isProbablySafeHttpUrl(trimmed)) {
      toast.error("Please enter a valid http(s) URL.");
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
    setShowLinkModal(false);
    setLinkUrl("");
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleInsertImage() {
    if (!editor || !imageFile) return;

    if (!onImageUpload) {
      toast.error("Image upload not configured");
      return;
    }

    setUploadingImage(true);
    try {
      // Get placeholder URL from parent component
      const result = await onImageUpload(imageFile);

      // Insert image with placeholder URL
      // The parent component will replace this with the real URL when post is submitted
      editor.chain().focus().setImage({ src: result.url }).run();

      setShowImageModal(false);
      setImageFile(null);
      setImagePreview("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to prepare image");
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <>
      <div className="border-neutral bg-base-100 focus-within:border-neutral relative isolate overflow-x-auto rounded-md border transition-colors">
        <div className="relative z-20">
          {editor ? (
            <MenuBar
              editor={editor}
              onOpenLinkModal={handleOpenLinkModal}
              onOpenImageModal={() => setShowImageModal(true)}
            />
          ) : null}
        </div>
        <div className="relative z-0 overflow-hidden">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="border-neutral bg-base-100 w-full max-w-md rounded-lg border p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base-content text-lg font-bold">Add Link</h3>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl("");
                }}
                className="hover:bg-base-300 rounded-full p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="border-neutral bg-base-100 text-base-content focus:border-primary mb-4 w-full rounded-lg border px-4 py-2 text-sm focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSetLink();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl("");
                }}
                className="text-base-content/70 hover:bg-base-300 rounded-full px-4 py-2 text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetLink}
                className="bg-primary text-primary-content hover:bg-primary/90 rounded-full px-4 py-2 text-sm font-bold transition-colors"
              >
                {linkUrl ? "Set Link" : "Remove Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="border-neutral bg-base-100 w-full max-w-md rounded-lg border p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base-content text-lg font-bold">Upload Image</h3>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setImageFile(null);
                  setImagePreview("");
                }}
                className="hover:bg-base-300 rounded-full p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block w-full cursor-pointer">
                <div className="border-neutral bg-base-200 hover:bg-base-300 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-48 rounded" />
                  ) : (
                    <>
                      <ImagePlus size={32} className="text-base-content/50" />
                      <span className="text-base-content/70 text-sm">Click to select image</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
              {imageFile && <p className="text-base-content/70 mt-2 text-xs">{imageFile.name}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setImageFile(null);
                  setImagePreview("");
                }}
                className="text-base-content/70 hover:bg-base-300 rounded-full px-4 py-2 text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertImage}
                disabled={!imageFile || uploadingImage}
                className="bg-primary text-primary-content hover:bg-primary/90 rounded-full px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
              >
                {uploadingImage ? "Uploading..." : "Insert Image"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
