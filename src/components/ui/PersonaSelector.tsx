"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { apiFetchJson } from "@/lib/api/fetch-json";
import Avatar from "@/components/ui/Avatar";

export type PersonaOption = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string;
};

interface PersonaSelectorProps {
  value: string;
  onChange: (personaId: string, option?: PersonaOption) => void;
  initialOptions?: PersonaOption[];
  placeholder?: string;
  disabled?: boolean;
}

function normalizePersonaQuery(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function queryMatchesPersona(query: string, persona: PersonaOption) {
  if (query.length === 0) {
    return true;
  }

  const username = persona.username.toLowerCase();
  const displayName = persona.display_name.toLowerCase();

  return username.includes(query) || displayName.includes(query);
}

export default function PersonaSelector({
  value,
  onChange,
  initialOptions = [],
  placeholder = "Search persona...",
  disabled = false,
}: PersonaSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PersonaOption[]>(initialOptions);
  const [recentSelection, setRecentSelection] = useState<PersonaOption | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  // Sync options with initialOptions
  useEffect(() => {
    setOptions(initialOptions);
  }, [initialOptions]);

  const selectedPersona = useMemo(() => {
    return options.find((p) => p.id === value) || initialOptions.find((p) => p.id === value);
  }, [options, initialOptions, value]);

  useEffect(() => {
    if (selectedPersona) {
      setRecentSelection(selectedPersona);
    }
  }, [selectedPersona]);

  const displayText = selectedPersona ? `@${selectedPersona.username}` : "";
  const inputValue = open || query.length > 0 ? query : displayText;
  const normalizedQuery = normalizePersonaQuery(query);

  const visibleOptions = useMemo(() => {
    const merged = [...options];

    if (recentSelection && queryMatchesPersona(normalizedQuery, recentSelection)) {
      const alreadyPresent = merged.some((persona) => persona.id === recentSelection.id);
      if (!alreadyPresent) {
        merged.unshift(recentSelection);
      }
    }

    return merged;
  }, [options, recentSelection, normalizedQuery]);

  // Search effect
  useEffect(() => {
    const isSelectedDisplayQuery =
      selectedPersona !== undefined && normalizedQuery === selectedPersona.username.toLowerCase();

    if (!open || normalizedQuery.length === 0 || isSelectedDisplayQuery) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (normalizedQuery) {
          params.set("q", normalizedQuery);
        }

        const res = await apiFetchJson<{ items: PersonaOption[] }>(
          `/api/admin/ai/personas?${params.toString()}`,
        );

        if (!cancelled) {
          setOptions(res.items);
        }
      } catch (err) {
        console.error("Failed to fetch personas:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalizedQuery, open, selectedPersona]);

  useEffect(
    () => () => {
      clearBlurTimeout();
    },
    [],
  );

  const handleInputText = (nextQuery: string) => {
    setQuery(nextQuery);
    if (!open) {
      setOpen(true);
    }
    if (value) {
      onChange("");
    }
  };

  const avatarPersona =
    selectedPersona && (!open || query === displayText) ? selectedPersona : null;
  const leftAdornment = avatarPersona ? (
    <Avatar
      src={avatarPersona.avatar_url || undefined}
      fallbackSeed={avatarPersona.username}
      size="xs"
      isPersona
    />
  ) : (
    <Search size={14} />
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute top-1/2 left-3 z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center opacity-70">
          {leftAdornment}
        </div>
        <input
          type="text"
          className="input input-bordered input-sm w-full pr-10 pl-10"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => handleInputText(e.target.value)}
          onFocus={() => {
            clearBlurTimeout();
            setOpen(true);
            setQuery((currentQuery) => (currentQuery.length > 0 ? currentQuery : displayText));
          }}
          onBlur={() => {
            // Delay to allow mousedown on options
            clearBlurTimeout();
            blurTimeoutRef.current = window.setTimeout(() => {
              setOpen(false);
              setLoading(false);
              blurTimeoutRef.current = null;
            }, 200);
          }}
          disabled={disabled}
          autoComplete="off"
        />
        <div className="absolute top-1/2 right-3 -translate-y-1/2">
          {loading ? <Loader2 size={14} className="animate-spin opacity-50" /> : null}
        </div>
      </div>

      {open && (
        <div className="bg-base-100 border-base-300 absolute z-[150] mt-1 max-h-60 w-full overflow-auto rounded-lg border shadow-xl">
          {visibleOptions.length === 0 && !loading ? (
            <div className="px-4 py-3 text-center text-sm opacity-50">No personas found</div>
          ) : (
            <div className="p-1">
              {visibleOptions.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  className={`hover:bg-base-200 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                    value === persona.id ? "bg-base-200" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearBlurTimeout();
                    setRecentSelection(persona);
                    onChange(persona.id, persona);
                    setOpen(false);
                    setQuery("");
                    setLoading(false);
                  }}
                >
                  <Avatar
                    src={persona.avatar_url || undefined}
                    fallbackSeed={persona.username}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="block truncate text-sm font-medium">
                        {persona.display_name}
                      </span>
                    </div>
                    <span className="block truncate text-xs opacity-60">@{persona.username}</span>
                  </div>
                  {value === persona.id && (
                    <div className="badge badge-primary badge-xs">Selected</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
