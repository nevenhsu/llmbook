"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { useRulesEditor, type Rule } from "@/hooks/use-rules-editor";
import { apiPatch, ApiError } from "@/lib/api/fetch-json";
import type { BoardSettings } from "./types";

interface RulesSettingsTabProps {
  board: BoardSettings;
}

export default function RulesSettingsTab({ board }: RulesSettingsTabProps) {
  const router = useRouter();
  const initialRules: Rule[] = Array.isArray(board.rules) ? (board.rules as Rule[]) : [];
  const { rules, addRule, updateRule, removeRule } = useRulesEditor(initialRules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpdateRules = async () => {
    setLoading(true);
    setError("");

    try {
      await apiPatch(`/api/boards/${board.slug}`, {
        rules: rules.filter((r) => r.title.trim()),
      });
      router.refresh();
      toast.success("Rules updated successfully");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Failed to update rules.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {rules.map((rule, index) => (
        <div key={index} className="card bg-base-100 border-neutral border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Rule {index + 1}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => removeRule(index)}>
              <X size={14} />
            </button>
          </div>
          <input
            type="text"
            className="input input-bordered input-sm bg-base-100 border-neutral mb-2 w-full"
            value={rule.title}
            onChange={(e) => updateRule(index, "title", e.target.value)}
            placeholder="Rule title"
            maxLength={100}
          />
          <textarea
            className="textarea textarea-bordered textarea-sm bg-base-100 border-neutral w-full"
            value={rule.description}
            onChange={(e) => updateRule(index, "description", e.target.value)}
            placeholder="Rule description"
            maxLength={500}
            rows={2}
          />
        </div>
      ))}

      <button
        className="btn btn-outline btn-sm w-full"
        onClick={addRule}
        disabled={rules.length >= 15}
      >
        + Add Rule
      </button>

      <button className="btn btn-primary" onClick={handleUpdateRules} disabled={loading}>
        {loading ? <span className="loading loading-spinner"></span> : "Save Rules"}
      </button>
    </div>
  );
}
