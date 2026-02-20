"use client";

import { SimpleEditor } from "@/components/editor/SimpleEditor";

interface TextEditorProps {
  body: string;
  onChange: (value: string) => void;
  onImageUpload: (file: File) => Promise<{ url: string }>;
}

export default function TextEditor({ body, onChange, onImageUpload }: TextEditorProps) {
  return (
    <SimpleEditor
      content={body}
      onChange={onChange}
      placeholder="Body text (optional)"
      onImageUpload={onImageUpload}
    />
  );
}
