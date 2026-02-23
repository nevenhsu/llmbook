import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

const mentionMarkdownRegex = /@\[(.+?)\]\(mention:([^)]+)\)/g;

function escapeMarkdownText(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+!|>])/g, "\\$1");
}

function isLikelyHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function preprocessMentionsForEditor(markdownContent: string): string {
  return markdownContent.replace(mentionMarkdownRegex, (_full, label, userId) => {
    const safeLabel = String(label || "").replace(/"/g, "&quot;");
    const safeUserId = String(userId || "").replace(/"/g, "&quot;");
    return `<span class="mention" data-type="mention" data-id="${safeUserId}" data-label="${safeLabel}">@${safeLabel}</span>`;
  });
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownText(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(serializeNode).join("");

  if (tag === "span" && el.dataset.type === "mention" && el.dataset.id) {
    const label = (el.dataset.label || el.textContent || "").replace(/^@/, "").trim();
    return `@[${label}](mention:${el.dataset.id})`;
  }

  if (tag === "p") {
    return `${children}\n\n`;
  }

  if (tag === "br") {
    return "  \n";
  }

  if (tag === "strong" || tag === "b") {
    return `**${children}**`;
  }

  if (tag === "em" || tag === "i") {
    return `*${children}*`;
  }

  if (tag === "s" || tag === "strike") {
    return `~~${children}~~`;
  }

  if (tag === "code" && el.parentElement?.tagName.toLowerCase() !== "pre") {
    return `\`${(el.textContent ?? "").replace(/`/g, "\\`")}\``;
  }

  if (tag === "pre") {
    const code = el.querySelector("code")?.textContent ?? el.textContent ?? "";
    return `\n\`\`\`\n${code}\n\`\`\`\n\n`;
  }

  if (tag === "blockquote") {
    const lines = children
      .trim()
      .split("\n")
      .map((line) => `> ${line}`.trimEnd())
      .join("\n");
    return `${lines}\n\n`;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    return `${"#".repeat(level)} ${children.trim()}\n\n`;
  }

  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    const text = children || href;
    return `[${text}](${href})`;
  }

  if (tag === "img") {
    const alt = el.getAttribute("alt") ?? "";
    const src = el.getAttribute("src") ?? "";
    return `![${alt}](${src})`;
  }

  if (tag === "ul") {
    const items = Array.from(el.children)
      .filter((c) => c.tagName.toLowerCase() === "li")
      .map((li) => `- ${serializeNode(li).trim()}`)
      .join("\n");
    return `${items}\n\n`;
  }

  if (tag === "ol") {
    const items = Array.from(el.children)
      .filter((c) => c.tagName.toLowerCase() === "li")
      .map((li, idx) => `${idx + 1}. ${serializeNode(li).trim()}`)
      .join("\n");
    return `${items}\n\n`;
  }

  if (tag === "li") {
    return `${children}\n`;
  }

  return children;
}

export function markdownToEditorHtml(content: string): string {
  const normalized = normalizeNewlines(content || "");
  if (!normalized.trim()) {
    return "";
  }

  if (isLikelyHtml(normalized)) {
    return normalized;
  }

  return markdown.render(preprocessMentionsForEditor(normalized));
}

export function editorHtmlToMarkdown(html: string): string {
  if (typeof window === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  const output = Array.from(doc.body.childNodes).map(serializeNode).join("");
  return normalizeNewlines(output)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isMarkdownContentEmpty(content: string): boolean {
  if (!content) return true;

  const withoutMentions = content.replace(mentionMarkdownRegex, "").trim();
  if (!withoutMentions) {
    return true;
  }

  const withoutImages = withoutMentions.replace(/!\[[^\]]*]\(([^)]+)\)/g, "").trim();
  return withoutImages.length === 0;
}
