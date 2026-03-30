/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiAgentMemoryPage from "@/components/admin/agent-panel/AiAgentMemoryPage";
import { buildMockMemoryPreviewSet } from "@/lib/ai/agent/testing/mock-memory-preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AiAgentMemoryPage", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders memory sections, allows persona switching, and supports runtime API actions", async () => {
    const mockSet = buildMockMemoryPreviewSet();

    await act(async () => {
      root.render(
        React.createElement(AiAgentMemoryPage, {
          fixturePreviews: mockSet,
          runtimePreviews: mockSet,
        }),
      );
    });

    expect(container.textContent).toContain("AI Agent Memory Lab");
    expect(container.textContent).toContain("Recent Short Memories");
    expect(container.textContent).toContain("Latest Write Preview");
    expect(container.textContent).toContain("Compression Batch Preview");
    expect(container.textContent).toContain("Rendered Long-Memory Preview");
    expect(container.textContent).toContain("View latest write detail");
    expect(container.textContent).toContain("View compression batch detail");
    expect(container.textContent).toContain("View compression output detail");
    expect(container.textContent).toContain("View rendered long memory");
    expect(container.textContent).toContain("Persist latest write");
    expect(container.textContent).toContain("Orchid");
    expect(container.textContent).toContain("Kept an open loop");

    const latestWriteDetailButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("View latest write detail"),
    );
    expect(latestWriteDetailButton).not.toBeNull();

    await act(async () => {
      latestWriteDetailButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Latest Write Detail");
    expect(container.textContent).toContain("deterministic thread-memory path");

    const closeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Close",
    );
    await act(async () => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Latest Write Detail");

    const runtimeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Runtime"),
    );
    await act(async () => {
      runtimeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latestWritePreview: {
          path: "llm_post",
          summary: "Latest successful post would follow the staged LLM memory-write path.",
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const latestWriteButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Preview latest write"),
    );
    expect(latestWriteButton).not.toBeNull();

    await act(async () => {
      latestWriteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/memory/personas/persona-1/latest-write-preview",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(container.textContent).toContain("Memory API Payload");

    const select = container.querySelector("select");
    expect(select).not.toBeNull();

    await act(async () => {
      select!.value = "persona-2";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Marlowe");
    expect(container.textContent).toContain("glam-rock irony");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          mode: "persisted",
          personaId: "persona-2",
          summary: "Persisted latest memory write for persona-2.",
          persistedMemoryId: "memory-write-9",
          latestWritePreview: mockSet.previews[1].latestWritePreview,
          verificationTrace: {
            persistedMemoryId: "memory-write-9",
            selectedTaskId: "task-2",
            persistedMemory: {
              id: "memory-write-9",
              content: "Post memory for Marlowe: post result from notifications:notification-1",
            },
          },
          preview: mockSet.previews[1],
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const persistLatestWriteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Persist latest write"),
    );
    expect(persistLatestWriteButton).not.toBeNull();

    await act(async () => {
      persistLatestWriteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Memory Verification Trace");
    expect(container.textContent).toContain("memory-write-9");
    expect(container.textContent).toContain("task-2");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          mode: "persisted",
          personaId: "persona-2",
          summary: "Persisted canonical long memory and removed 2 compressible short-memory rows.",
          persistedLongMemoryId: "long-memory-9",
          deletedShortMemoryIds: ["memory-thread-2", "memory-board-3"],
          protectedShortMemoryIds: [],
          verificationTrace: {
            persistedLongMemoryId: "long-memory-9",
            persistedLongMemory: {
              id: "long-memory-9",
              content: "# Canonical Memory for Marlowe",
            },
            cleanup: {
              deletedShortMemoryIds: ["memory-thread-2", "memory-board-3"],
              protectedShortMemoryIds: [],
            },
          },
          preview: mockSet.previews[1],
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const persistCompressionButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Persist compression"),
    );
    expect(persistCompressionButton).not.toBeNull();

    await act(async () => {
      persistCompressionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Memory Verification Trace");
    expect(container.textContent).toContain("long-memory-9");
    expect(container.textContent).toContain("memory-thread-2");
  });
});
