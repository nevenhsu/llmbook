"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";

interface Props {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[#343536] bg-transparent p-2 text-[#818384]">
      {/* Bold */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("bold") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Bold"
      >
        <span className="text-sm font-bold">B</span>
      </button>

      {/* Italic */}
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("italic") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Italic"
      >
        <span className="text-sm italic italic-font">i</span>
      </button>

      {/* Strike */}
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("strike") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Strikethrough"
      >
        <span className="text-sm line-through">S</span>
      </button>

      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 text-xs"
        title="Superscript"
      >
        X<sup>2</sup>
      </button>

      {/* Text Size (simplified as H1 toggle for now) */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("heading", { level: 1 }) ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Text Size"
      >
        <span className="text-lg">T</span>
      </button>

      <div className="mx-1 h-6 w-[1px] bg-[#343536]" />

      {/* Link */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        title="Link"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
          />
        </svg>
      </button>

      {/* Image */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        title="Image"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
      </button>

      {/* Video */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        title="Video"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      </button>

      <div className="mx-1 h-6 w-[1px] bg-[#343536]" />

      {/* Bullet List */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("bulletList") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Bullet List"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
      </button>

      {/* Ordered List */}
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("orderedList") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Ordered List"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
      </button>

      <div className="mx-1 h-6 w-[1px] bg-[#343536]" />

      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        title="Alert"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
      </button>

      {/* Quote */}
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("blockquote") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Blockquote"
      >
        <span className="text-sm font-serif">66</span>
      </button>

      {/* Code */}
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("code") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Code"
      >
        <span className="text-xs">&lt;/&gt;</span>
      </button>

      {/* Code Block */}
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`flex h-8 w-8 items-center justify-center rounded hover:bg-white/10 ${editor.isActive("codeBlock") ? "text-[#D7DADC] bg-white/10" : ""}`}
        title="Code Block"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
          />
        </svg>
      </button>

      {/* Table (Mockup anchor) */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        title="Table"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125V5.625a1.125 1.125 0 0 1 1.125-1.125h17.25a1.125 1.125 0 0 1 1.125 1.125v12.75a1.125 1.125 0 0 1-1.125 1.125m-17.25 0h17.25"
          />
        </svg>
      </button>

      <div className="flex-1" />

      {/* More */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded hover:bg-white/10"
        title="More"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
          />
        </svg>
      </button>
    </div>
  );
};

export default function RichTextEditor({
  content,
  onChange,
  placeholder,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "Text (optional)",
        emptyEditorClass:
          "is-editor-empty before:text-[#818384] before:content-[attr(data-placeholder)] before:float-left before:pointer-events-none before:h-0",
      }),
      Link.configure({
        openOnClick: false,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none p-4 min-h-[200px] focus:outline-none text-sm leading-relaxed",
      },
    },
    immediatelyRender: false,
  });

  return (
    <div className="overflow-hidden rounded-[20px] border border-[#343536] bg-[#0E1011] transition-colors hover:border-[#D7DADC] focus-within:border-[#D7DADC]">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
