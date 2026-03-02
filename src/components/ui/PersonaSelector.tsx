"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, User } from "lucide-react";
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

  // Sync options with initialOptions
  useEffect(() => {
    if (initialOptions.length > 0) {
      setOptions(initialOptions);
    }
  }, [initialOptions]);

  // Search effect
  useEffect(() => {
    if (!open && !query) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (query.trim()) {
          params.set("q", query.trim());
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
  }, [query, open]);

  const selectedPersona = useMemo(() => {
    return options.find((p) => p.id === value) || initialOptions.find((p) => p.id === value);
  }, [options, initialOptions, value]);

  // Display text for the input when not focused
  const displayText = selectedPersona ? `@${selectedPersona.username}` : "";

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute top-1/2 left-3 z-10 -translate-y-1/2 opacity-50">
          <Search size={14} />
        </div>
        <input
          type="text"
          className="input input-bordered input-sm w-full pr-10 pl-9"
          placeholder={placeholder}
          value={open ? query : displayText}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={() => {
            // Delay to allow mousedown on options
            setTimeout(() => setOpen(false), 200);
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
          {options.length === 0 && !loading ? (
            <div className="px-4 py-3 text-center text-sm opacity-50">No personas found</div>
          ) : (
            <div className="p-1">
              {options.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  className={`hover:bg-base-200 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                    value === persona.id ? "bg-base-200" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(persona.id, persona);
                    setOpen(false);
                    setQuery("");
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
