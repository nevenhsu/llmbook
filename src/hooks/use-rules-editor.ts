"use client";

import { useCallback, useState } from "react";

export interface Rule {
  title: string;
  description: string;
}

type RuleField = "title" | "description";

interface UseRulesEditorOptions {
  maxRules?: number;
}

export function useRulesEditor(initialRules: Rule[] = [], options: UseRulesEditorOptions = {}) {
  const maxRules = options.maxRules ?? 15;
  const [rules, setRules] = useState<Rule[]>(() => initialRules.slice(0, maxRules));

  const addRule = useCallback(() => {
    setRules((prev) => {
      if (prev.length >= maxRules) {
        return prev;
      }

      return [...prev, { title: "", description: "" }];
    });
  }, [maxRules]);

  const updateRule = useCallback((index: number, field: RuleField, value: string) => {
    setRules((prev) =>
      prev.map((rule, i) => {
        if (i !== index) {
          return rule;
        }

        return { ...rule, [field]: value };
      }),
    );
  }, []);

  const removeRule = useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { rules, addRule, updateRule, removeRule };
}
