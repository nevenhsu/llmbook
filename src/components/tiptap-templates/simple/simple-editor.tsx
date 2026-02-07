"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
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
} from "lucide-react";

export interface SimpleEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
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
      className={`p-1.5 rounded hover:bg-surface-hover transition-colors ${active ? "bg-highlight text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function MenuBar({ editor }: { editor: Editor }) {
  const headingLevels = [1, 2, 3] as const;

  function setLink() {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previousUrl ?? "");
    if (url === null) return;

    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    if (!isProbablySafeHttpUrl(trimmed)) {
      window.alert("Please enter a valid http(s) URL.");
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed })
      .run();
  }

  function insertImage() {
    const url = window.prompt("Image URL");
    if (!url) return;

    const trimmed = url.trim();
    if (!isProbablySafeHttpUrl(trimmed)) {
      window.alert("Please enter a valid http(s) image URL.");
      return;
    }

    editor.chain().focus().setImage({ src: trimmed }).run();
  }

  return (
    <div className="relative z-50 flex flex-wrap items-center gap-0.5 overflow-visible border-b border-border-default bg-surface/60 px-2 py-1 backdrop-blur-sm">
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

      <div className="mx-1 h-6 w-px bg-border-default" />

      <div className="dropdown dropdown-bottom">
        <button
          type="button"
          tabIndex={0}
          className="flex items-center gap-1 p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Text style"
          title="Text style"
        >
          <span className="text-xs font-bold uppercase tracking-wider">Text</span>
          <ChevronDown size={14} />
        </button>
        <ul
          tabIndex={-1}
          className="dropdown-content absolute left-0 mt-1 w-44 rounded-md border border-border-default bg-surface p-1 shadow-xl z-[110]"
        >
          <li>
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-surface-hover ${editor.isActive("paragraph") ? "bg-highlight text-text-primary" : "text-text-secondary"}`}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              Paragraph
            </button>
          </li>
          {headingLevels.map((level) => (
            <li key={level}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-surface-hover ${editor.isActive("heading", { level }) ? "bg-highlight text-text-primary" : "text-text-secondary"}`}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level }).run()
                }
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

      <div className="mx-1 h-6 w-px bg-border-default" />

      <ToolbarButton
        label="Add or edit link"
        onClick={setLink}
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
      <ToolbarButton label="Insert image" onClick={insertImage}>
        <ImagePlus size={16} />
      </ToolbarButton>
    </div>
  );
}

export function SimpleEditor({
  content,
  onChange,
  placeholder,
}: SimpleEditorProps) {
  const [internalContent, setInternalContent] = useState<string>(content ?? "");

  const effectiveContent = content ?? internalContent;
  const emitChange = useMemo(() => {
    return (next: string) => {
      if (onChange) onChange(next);
      if (content === undefined) setInternalContent(next);
    };
  }, [content, onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || "Text (optional)",
        emptyEditorClass:
          "is-editor-empty before:text-text-muted before:content-[attr(data-placeholder)] before:float-left before:pointer-events-none before:h-0",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        allowBase64: false,
      }),
    ],
    content: effectiveContent,
    onUpdate: ({ editor }) => {
      emitChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none p-4 min-h-[250px] sm:min-h-[200px] focus:outline-none text-sm leading-relaxed text-text-primary",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (effectiveContent === editor.getHTML()) return;
    editor.commands.setContent(effectiveContent, { emitUpdate: false });
  }, [effectiveContent, editor]);

  return (
    <div className="relative isolate overflow-x-auto rounded-md border border-border-default bg-surface transition-colors focus-within:border-border-hover">
      <div className="relative z-20">
        {editor ? <MenuBar editor={editor} /> : null}
      </div>
      <div className="relative z-0 overflow-hidden">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
