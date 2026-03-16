/** @vitest-environment jsdom */

import { act } from "react";
import React, { useState } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PersonaSelector, { type PersonaOption } from "./PersonaSelector";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const personas: PersonaOption[] = [
  {
    id: "persona-1",
    username: "ai_luffy",
    display_name: "Monkey D. Luffy",
    avatar_url: "https://example.com/luffy.png",
  },
  {
    id: "persona-2",
    username: "ai_zoro",
    display_name: "Roronoa Zoro",
    avatar_url: "https://example.com/zoro.png",
  },
];

function PersonaSelectorHarness() {
  const [value, setValue] = useState(personas[0].id);

  return React.createElement(
    "div",
    null,
    React.createElement(PersonaSelector, {
      value,
      initialOptions: personas,
      onChange: (personaId: string) => setValue(personaId),
      placeholder: "Search persona...",
    }),
    React.createElement("div", { "data-selected-persona": true }, value || "none"),
  );
}

describe("PersonaSelector", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  const setNativeInputValue = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        const items = url.includes("q=ai_luff") ? [] : personas;
        return Promise.resolve({
          ok: true,
          json: async () => ({ items }),
          text: async () => "",
          headers: new Headers({ "Content-Type": "application/json" }),
        });
      }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.unstubAllGlobals();
    vi.useRealTimers();
    container.remove();
  });

  it("lets users clear a selected persona to empty and keep typing without triggering empty-query loading", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaSelectorHarness));
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const input = container.querySelector(
      'input[placeholder="Search persona..."]',
    ) as HTMLInputElement | null;
    expect(input?.value).toBe("@ai_luffy");
    expect(container.querySelector('img[src="https://example.com/luffy.png"]')).not.toBeNull();

    await act(async () => {
      input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      input?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(input?.value).toBe("@ai_luffy");
    expect(container.querySelector(".animate-spin")).toBeNull();

    await act(async () => {
      if (input) {
        setNativeInputValue?.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    expect(input?.value).toBe("");
    expect(container.querySelector("[data-selected-persona]")?.textContent).toBe("none");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).toHaveBeenCalledTimes(0);

    await act(async () => {
      if (input) {
        setNativeInputValue?.call(input, "m");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    expect(input?.value).toBe("m");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the recently selected persona in the dropdown when the edited query still matches it", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaSelectorHarness));
    });

    const input = container.querySelector(
      'input[placeholder="Search persona..."]',
    ) as HTMLInputElement | null;

    await act(async () => {
      input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
      input?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    await act(async () => {
      if (input) {
        setNativeInputValue?.call(input, "@ai_luff");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    expect(container.querySelector("[data-selected-persona]")?.textContent).toBe("none");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(container.textContent).toContain("Monkey D. Luffy");
    expect(container.textContent).toContain("@ai_luffy");
    expect(container.textContent).not.toContain("No personas found");
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain(
      "q=ai_luff",
    );
  });
});
