import { Mention } from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownParseResult,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext,
} from "@tiptap/core";
import { MentionList, MentionListRef } from "./MentionList";

export interface MentionSuggestion {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

// Set to true to simulate slow network for testing loading state
const SIMULATE_SLOW_NETWORK = false;
const NETWORK_DELAY_MS = 3000; // 3 seconds to ensure we see loading

async function fetchMentionSuggestions(query: string): Promise<MentionSuggestion[]> {
  try {
    const res = await fetch(`/api/mentions/suggestions?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();

    // Simulate slow network for testing (DEV ONLY)
    if (SIMULATE_SLOW_NETWORK && process.env.NODE_ENV === "development") {
      await new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));
    }

    return data;
  } catch {
    return [];
  }
}

export const MentionExtension = Mention.extend({
  markdownTokenizer: {
    name: "mention",
    level: "inline" as const,
    start: (src: string) => src.indexOf("@["),
    tokenize: (
      src: string,
      _tokens: MarkdownToken[],
      _lexer: MarkdownLexerConfiguration,
    ): MarkdownToken | undefined => {
      const match = /^@\[(.+?)\]\(mention:([^)]+)\)/.exec(src);
      if (!match) return undefined;
      return {
        type: "mention",
        raw: match[0],
        label: match[1],
        id: match[2],
      };
    },
  },

  parseMarkdown: (token: MarkdownToken, _helpers: MarkdownParseHelpers): MarkdownParseResult => {
    return {
      type: "mention",
      attrs: {
        id: token.id,
        label: token.label,
      },
    };
  },

  renderMarkdown: (
    node: JSONContent,
    _helpers: MarkdownRendererHelpers,
    _context: RenderContext,
  ): string => {
    return `@[${node.attrs?.label}](mention:${node.attrs?.id})`;
  },
}).configure({
  HTMLAttributes: {
    class: "mention",
  },

  renderHTML({ node }) {
    return [
      "span",
      {
        class: "mention",
        "data-type": "mention",
        "data-id": node.attrs.id,
        "data-label": node.attrs.label,
      },
      `@${node.attrs.label}`,
    ];
  },

  suggestion: {
    char: "@",
    allowSpaces: false,
    startOfLine: false,
    allowedPrefixes: null,

    items: async ({ query }) => {
      return fetchMentionSuggestions(query);
    },

    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: TippyInstance[] | null = null;
      return {
        onStart: (props) => {
          // If items are already available, don't show loading
          // This happens when items() completes before onStart is called
          const shouldShowLoading = props.items.length === 0;

          component = new ReactRenderer(MentionList, {
            props: {
              ...props,
              loading: shouldShowLoading,
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            maxWidth: 320,
          });
        },

        onUpdate(props) {
          // Show loading when query changes (user is typing)
          const isSearching = props.query.length > 0 && props.items.length === 0;

          component?.updateProps({
            ...props,
            loading: isSearching,
          });

          if (!props.clientRect) return;

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  },
});
