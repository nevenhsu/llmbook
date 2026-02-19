"use client";

import { useState } from "react";
import { MentionList } from "@/components/tiptap-extensions/mention/MentionList";
import {
  MOCK_SUGGESTIONS,
  MOCK_SEARCH_RESULTS,
  MOCK_EMPTY,
  MOCK_SINGLE,
  MOCK_LONG_LIST,
} from "./mock-data";
import { Search, RefreshCw } from "lucide-react";

export default function MentionsPreviewPage() {
  const [scenario, setScenario] = useState<
    "default" | "search" | "loading" | "empty-search" | "empty-default" | "single" | "long"
  >("default");
  const [query, setQuery] = useState("");

  const mockCommand = (item: { id: string; label: string }) => {
    console.log("Selected:", item);
    alert(`Selected: @${item.label} (ID: ${item.id})`);
  };

  const getScenarioData = () => {
    switch (scenario) {
      case "default":
        return { items: MOCK_SUGGESTIONS, query: "", loading: false };
      case "search":
        return { items: MOCK_SEARCH_RESULTS, query: "alice", loading: false };
      case "loading":
        return { items: [], query: "", loading: true };
      case "empty-search":
        return { items: MOCK_EMPTY, query: "xyz123", loading: false };
      case "empty-default":
        return { items: MOCK_EMPTY, query: "", loading: false };
      case "single":
        return { items: MOCK_SINGLE, query: "", loading: false };
      case "long":
        return { items: MOCK_LONG_LIST, query: "", loading: false };
      default:
        return { items: MOCK_SUGGESTIONS, query: "", loading: false };
    }
  };

  const scenarioData = getScenarioData();

  return (
    <div className="bg-base-100 container mx-auto max-w-4xl p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-base-content mb-2 text-3xl font-bold">Mention Suggestions Preview</h1>
        <p className="text-base-content/70">
          Preview different states of the mention suggestions dropdown
        </p>
      </div>

      {/* Scenario Selector */}
      <div className="bg-base-200 mb-8 rounded-lg p-6">
        <h2 className="text-base-content mb-4 flex items-center gap-2 text-lg font-semibold">
          <RefreshCw size={20} />
          Select Scenario
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setScenario("default")}
            className={`btn btn-sm ${scenario === "default" ? "btn-primary" : "btn-ghost"}`}
          >
            Default (5 users)
          </button>
          <button
            onClick={() => setScenario("search")}
            className={`btn btn-sm ${scenario === "search" ? "btn-primary" : "btn-ghost"}`}
          >
            Search Results (2 users)
          </button>
          <button
            onClick={() => setScenario("loading")}
            className={`btn btn-sm ${scenario === "loading" ? "btn-primary" : "btn-ghost"}`}
          >
            Loading State
          </button>
          <button
            onClick={() => setScenario("empty-search")}
            className={`btn btn-sm ${scenario === "empty-search" ? "btn-primary" : "btn-ghost"}`}
          >
            No Search Results
          </button>
          <button
            onClick={() => setScenario("empty-default")}
            className={`btn btn-sm ${scenario === "empty-default" ? "btn-primary" : "btn-ghost"}`}
          >
            No Users Available
          </button>
          <button
            onClick={() => setScenario("single")}
            className={`btn btn-sm ${scenario === "single" ? "btn-primary" : "btn-ghost"}`}
          >
            Single User
          </button>
          <button
            onClick={() => setScenario("long")}
            className={`btn btn-sm ${scenario === "long" ? "btn-primary" : "btn-guest"}`}
          >
            Long List (8 users)
          </button>
        </div>
      </div>

      {/* Scenario Info */}
      <div className="bg-base-200 mb-6 rounded-lg p-4">
        <h3 className="text-base-content mb-2 font-semibold">Current Scenario Details</h3>
        <div className="text-base-content/70 space-y-1 text-sm">
          <p>
            <span className="font-medium">Items:</span> {scenarioData.items.length}
          </p>
          <p>
            <span className="font-medium">Query:</span>{" "}
            {scenarioData.query ? `"${scenarioData.query}"` : "(empty)"}
          </p>
          <p>
            <span className="font-medium">Loading:</span> {scenarioData.loading ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* Preview Area */}
      <div className="bg-base-200 rounded-lg p-8">
        <h2 className="text-base-content mb-4 flex items-center gap-2 text-lg font-semibold">
          <Search size={20} />
          Mention Dropdown Preview
        </h2>

        <div className="flex items-start justify-center py-12">
          <div className="relative">
            {/* Simulated Input */}
            <div className="bg-base-100 border-neutral mb-4 rounded-lg border p-3">
              <p className="text-base-content/50 text-sm">
                Type <code className="bg-base-300 rounded px-1">@</code> to mention someone...
              </p>
            </div>

            {/* Mention List Component */}
            <div className="relative">
              <MentionList
                items={scenarioData.items}
                command={mockCommand}
                query={scenarioData.query}
                loading={scenarioData.loading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Usage Guide */}
      <div className="bg-base-200 mt-8 rounded-lg p-6">
        <h3 className="text-base-content mb-3 text-lg font-semibold">Usage Guide</h3>
        <div className="text-base-content/70 space-y-2 text-sm">
          <p>
            <strong>Default:</strong> Shows top 5 users (following or recommended)
          </p>
          <p>
            <strong>Search Results:</strong> Shows filtered results when user types after @
          </p>
          <p>
            <strong>Loading:</strong> Initial loading state when fetching data
          </p>
          <p>
            <strong>No Search Results:</strong> When search query has no matches
          </p>
          <p>
            <strong>No Users Available:</strong> When database has no users to suggest
          </p>
          <p>
            <strong>Single User:</strong> Edge case with only one user (e.g., @dev)
          </p>
          <p>
            <strong>Long List:</strong> Shows scrollable list with many users
          </p>
        </div>
      </div>

      {/* Keyboard Navigation Guide */}
      <div className="bg-base-200 mt-6 rounded-lg p-6">
        <h3 className="text-base-content mb-3 text-lg font-semibold">Keyboard Navigation</h3>
        <div className="text-base-content/70 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <kbd className="kbd kbd-sm">↑</kbd>
            <span className="ml-2">Move up</span>
          </div>
          <div>
            <kbd className="kbd kbd-sm">↓</kbd>
            <span className="ml-2">Move down</span>
          </div>
          <div>
            <kbd className="kbd kbd-sm">Enter</kbd>
            <span className="ml-2">Select</span>
          </div>
          <div>
            <kbd className="kbd kbd-sm">Tab</kbd>
            <span className="ml-2">Select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
