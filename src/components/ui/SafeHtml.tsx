"use client";

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { apiPost } from "@/lib/api/fetch-json";
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";

interface SafeHtmlProps {
  markdown: string;
  className?: string;
}

interface MentionData {
  username: string;
  displayName: string;
}

const mentionCache = new Map<string, MentionData | null>();
const mentionMarkdownPattern = /@\[(.+?)\]\(mention:([^)]+)\)/g;

export default function SafeHtml({ markdown, className = "" }: SafeHtmlProps) {
  const [resolvedHtml, setResolvedHtml] = useState<string>("");

  useEffect(() => {
    async function resolveMentions() {
      const source = markdown || "";
      const userIds: string[] = [];
      let match;
      const extractionRegex = new RegExp(mentionMarkdownPattern);
      while ((match = extractionRegex.exec(source)) !== null) {
        const userId = match[2];
        if (userId && !userIds.includes(userId)) {
          userIds.push(userId);
        }
      }

      const uncachedIds = userIds.filter((id) => !mentionCache.has(id));

      if (uncachedIds.length > 0) {
        try {
          const { users } = await apiPost<{ users: Record<string, MentionData | null> }>(
            "/api/mentions/resolve",
            { userIds: uncachedIds },
          );
          for (const id of uncachedIds) {
            mentionCache.set(id, users[id] ?? null);
          }
        } catch (error) {
          console.error("Error resolving mentions:", error);
          for (const id of uncachedIds) {
            mentionCache.set(id, null);
          }
        }
      }

      const mentionResolvedMarkdown = source.replace(
        new RegExp(mentionMarkdownPattern),
        (_full, rawLabel, userId) => {
          const label =
            String(rawLabel || "")
              .replace(/^@/, "")
              .trim() || "unknown";
          const user = mentionCache.get(String(userId));
          const preferredName = user?.displayName || user?.username || label;

          if (user?.username) {
            return `<a href="/u/${user.username}" class="mention text-primary hover:underline">@${preferredName}</a>`;
          }

          return `<span class="mention-invalid">@${label}</span>`;
        },
      );

      const html = markdownToEditorHtml(mentionResolvedMarkdown);
      const cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_URI_REGEXP: /^(?:(?:https?:|mailto:|tel:)|\/|#)/i,
        ADD_ATTR: ["data-type", "data-id", "data-label", "class"],
      });

      setResolvedHtml(cleanHtml);
    }

    void resolveMentions();
  }, [markdown]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: resolvedHtml }} />;
}
