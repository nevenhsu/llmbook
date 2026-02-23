export interface ParsedMention {
  userId: string;
  label: string;
}

/**
 * Parse mentions from markdown content using:
 * @[display](mention:userId)
 */
export function parseMentions(content: string): ParsedMention[] {
  if (!content) return [];

  const markdownRegex = /@\[(.+?)\]\(mention:([^)]+)\)/g;
  const parsed: ParsedMention[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = markdownRegex.exec(content)) !== null) {
    const [, label, userId] = match;
    if (userId && label && !seen.has(userId)) {
      seen.add(userId);
      parsed.push({ userId, label });
    }
  }

  return parsed;
}
