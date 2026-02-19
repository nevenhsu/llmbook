export interface ParsedMention {
  userId: string;
  username: string;
}

/**
 * Parse all valid mentions from HTML content
 * Only parses mentions with data-id (validated existing users)
 */
export function parseMentions(html: string): ParsedMention[] {
  if (!html) return [];

  const regex = /data-type="mention"[^>]*data-id="([^"]+)"[^>]*data-label="([^"]+)"/g;
  const parsed: ParsedMention[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = regex.exec(html)) !== null) {
    const [, userId, username] = match;
    if (userId && username && !seen.has(userId)) {
      seen.add(userId);
      parsed.push({ userId, username });
    }
  }

  return parsed;
}
