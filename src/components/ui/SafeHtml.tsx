"use client";

import { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { apiPost } from "@/lib/api/fetch-json";

interface SafeHtmlProps {
  html: string;
  className?: string;
}

interface MentionData {
  username: string;
  displayName: string;
}

const mentionCache = new Map<string, MentionData | null>();

export default function SafeHtml({ html, className = "" }: SafeHtmlProps) {
  const [resolvedHtml, setResolvedHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function resolveMentions() {
      const cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_URI_REGEXP: /^(?:(?:https?:|mailto:|tel:)|\/|#)/i,
        ADD_ATTR: ["data-type", "data-id", "data-label"],
      });

      const mentionRegex = /data-type="mention"[^>]*data-id="([^"]+)"/g;
      const userIds: string[] = [];
      let match;
      while ((match = mentionRegex.exec(cleanHtml)) !== null) {
        if (!userIds.includes(match[1])) {
          userIds.push(match[1]);
        }
      }

      if (userIds.length === 0) {
        setResolvedHtml(cleanHtml);
        setIsLoading(false);
        return;
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

      let processed = cleanHtml;

      for (const userId of userIds) {
        const user = mentionCache.get(userId);

        const mentionPattern = new RegExp(
          `<span[^>]*data-type="mention"[^>]*data-id="${userId}"[^>]*data-label="[^"]*"[^>]*>@[^<]*</span>`,
          "g",
        );

        if (user) {
          processed = processed.replace(
            mentionPattern,
            `<a href="/u/${user.username}" class="mention text-primary hover:underline">@${user.username}</a>`,
          );
        } else {
          processed = processed.replace(mentionPattern, (match) => {
            const labelMatch = match.match(/data-label="([^"]*)"/);
            const label = labelMatch ? labelMatch[1] : "deleted";
            return `<span class="text-base-content/50">@${label}</span>`;
          });
        }
      }

      setResolvedHtml(processed);
      setIsLoading(false);
    }

    resolveMentions();
  }, [html]);

  if (isLoading) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(html, {
            ALLOWED_URI_REGEXP: /^(?:(?:https?:|mailto:|tel:)|\/|#)/i,
          }),
        }}
      />
    );
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: resolvedHtml }} />;
}
