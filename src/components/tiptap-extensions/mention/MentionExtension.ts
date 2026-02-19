import { Mention } from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { MentionList, MentionListRef } from "./MentionList";

export interface MentionSuggestion {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

async function fetchMentionSuggestions(query: string): Promise<MentionSuggestion[]> {
  try {
    const res = await fetch(`/api/mentions/suggestions?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const MentionExtension = Mention.configure({
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
          component = new ReactRenderer(MentionList, {
            props,
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
          component?.updateProps(props);

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
