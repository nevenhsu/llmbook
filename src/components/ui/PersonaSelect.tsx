"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetchJson } from "@/lib/api/fetch-json";

export type PersonaSelectOption = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
};

type Props = {
  value: string;
  onChange: (personaId: string, option?: PersonaSelectOption) => void;
  initialOptions: PersonaSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  limit?: number;
};

export default function PersonaSelect({
  value,
  onChange,
  initialOptions,
  placeholder = "Search persona by username or display name",
  disabled = false,
  limit = 50,
}: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PersonaSelectOption[]>(initialOptions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOptions(initialOptions);
  }, [initialOptions]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        if (query.trim()) {
          params.set("q", query.trim());
        }
        const res = await apiFetchJson<{ items: PersonaSelectOption[] }>(
          `/api/admin/ai/personas?${params.toString()}`,
        );
        if (!cancelled) {
          setOptions(res.items);
        }
      } catch {
        if (!cancelled) {
          setOptions(initialOptions);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, limit, initialOptions]);

  const selected = useMemo(() => options.find((item) => item.id === value), [options, value]);

  return (
    <div className="space-y-2">
      <input
        className="input input-bordered input-sm w-full"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <select
        className="select select-bordered select-sm w-full"
        value={value}
        onChange={(e) => {
          const personaId = e.target.value;
          onChange(
            personaId,
            options.find((item) => item.id === personaId),
          );
        }}
        disabled={disabled}
      >
        <option value="">{loading ? "Loading..." : "Select persona"}</option>
        {options.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.display_name} ({persona.username})
          </option>
        ))}
      </select>
      {selected ? (
        <div className="text-xs opacity-70">
          Selected: {selected.display_name} ({selected.username})
        </div>
      ) : null}
    </div>
  );
}
