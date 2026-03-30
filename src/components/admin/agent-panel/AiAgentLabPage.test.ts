/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AiAgentLabPage from "@/components/admin/agent-panel/AiAgentLabPage";
import { buildMockIntakeRuntimePreviews } from "@/lib/ai/agent/testing/mock-intake-runtime-previews";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AiAgentLabPage", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders fixture controls and generates a dev-only intake preview payload", async () => {
    await act(async () => {
      root.render(
        React.createElement(AiAgentLabPage, {
          initialSnapshot: buildMockAiAgentOverviewSnapshot(),
          runtimePreviews: buildMockIntakeRuntimePreviews(),
        }),
      );
    });

    expect(container.textContent).toContain("AI Agent Lab");
    expect(container.textContent).toContain("Persisted Selector Batch Size");
    expect(container.textContent).toContain("100");
    expect(container.textContent).toContain("Generate test input");

    const select = container.querySelector("select");
    const input = container.querySelector('input[type="number"]');
    const generateButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Generate test input"),
    );
    const selectorButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Preview selector output"),
    );
    const resolvedButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Preview resolved personas"),
    );
    const candidatesButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Preview task candidates"),
    );
    const executionButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Preview execution artifacts"),
    );

    expect(select).not.toBeNull();
    expect(input).not.toBeNull();
    expect(generateButton).not.toBeUndefined();
    expect(selectorButton).not.toBeUndefined();
    expect(resolvedButton).not.toBeUndefined();
    expect(candidatesButton).not.toBeUndefined();
    expect(executionButton).not.toBeUndefined();

    await act(async () => {
      if (select instanceof HTMLSelectElement) {
        select.value = "notification-intake";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await act(async () => {
      if (input instanceof HTMLInputElement) {
        input.value = "0";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      selectorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resolvedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      candidatesButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      executionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Selector Input");
    expect(container.textContent).toContain('"fixtureMode": "notification-intake"');
    expect(container.textContent).toContain('"groupIndexOverride": 0');
    expect(container.textContent).toContain('"selectorReferenceBatchSize": 100');
    expect(container.textContent).toContain("Selector Output");
    expect(container.textContent).toContain('"selectedReferences"');
    expect(container.textContent).toContain("Selector Prompt Preview");
    expect(container.textContent).toContain("[system_baseline]");
    expect(container.textContent).toContain("Selector Model Payload");
    expect(container.textContent).toContain('"compactContext"');
    expect(container.textContent).toContain("Resolved Personas");
    expect(container.textContent).toContain('"username": "ai_orchid"');
    expect(container.textContent).toContain("Resolved Persona Cards");
    expect(container.textContent).toContain("Reference Sources");
    expect(container.textContent).toContain("Task Candidate Preview");
    expect(container.textContent).toContain('"dispatchKind": "notification"');
    expect(container.textContent).toContain(
      '"dedupeKey": "ai_orchid:notification-intake-1:mention"',
    );
    expect(container.textContent).toContain("Task Write Preview");
    expect(container.textContent).toContain('"dedupeExpectation": "insert"');
    expect(container.textContent).toContain("Task Injection Preview");
    expect(container.textContent).toContain('"rpcName": "inject_persona_tasks"');
    expect(container.textContent).toContain('"insertedCount": 4');
    expect(container.textContent).toContain("Execution Persona Context");
    expect(container.textContent).toContain('"referenceSource": "Yayoi Kusama"');
    expect(container.textContent).toContain("Execution Prompt Input");
    expect(container.textContent).toContain('"actionType": "comment"');
    expect(container.textContent).toContain("Execution Model Payload");
    expect(container.textContent).toContain('"maxOutputTokens"');
    expect(container.textContent).toContain("Execution Parsed Output");
    expect(container.textContent).toContain('"schemaValid": true');
    expect(container.textContent).toContain("Execution Audit Output");
    expect(container.textContent).toContain('"contract": "persona_output_audit"');
    expect(container.textContent).toContain("Execution Deterministic Checks");
    expect(container.textContent).toContain('"stage": "schema_validate"');
    expect(container.textContent).toContain("Execution Write Plan");
    expect(container.textContent).toContain('"table": "comments"');
    expect(container.textContent).toContain("Execution Preview");
    expect(container.textContent).toContain("Rendered Preview");
    expect(container.textContent).toContain("Audit Diagnostics");
  });

  it("can switch to runtime-backed mode and reuse the shared selector input", async () => {
    await act(async () => {
      root.render(
        React.createElement(AiAgentLabPage, {
          initialSnapshot: buildMockAiAgentOverviewSnapshot(),
          runtimePreviews: buildMockIntakeRuntimePreviews(),
        }),
      );
    });

    const select = container.querySelector("select");
    const generateButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Generate test input"),
    );

    await act(async () => {
      if (select instanceof HTMLSelectElement) {
        select.value = "runtime-notification";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("notification runtime snapshot");
    expect(container.textContent).toContain('"sourceId": "notification-1"');
  });
});
