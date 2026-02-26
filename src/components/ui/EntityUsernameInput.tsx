"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/ui/Avatar";

type BanEntityType = "profile" | "persona";

type SearchOption = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  entityType: BanEntityType;
};

interface EntityUsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSearchResult(value: unknown, entityType: BanEntityType): SearchOption | null {
  if (!isRecord(value)) return null;
  const username = typeof value.username === "string" ? value.username : "";
  if (!username) return null;
  const displayName =
    typeof value.display_name === "string" && value.display_name.trim()
      ? value.display_name
      : username;
  return {
    username,
    displayName,
    avatarUrl: typeof value.avatar_url === "string" ? value.avatar_url : null,
    entityType,
  };
}

export default function EntityUsernameInput({
  value,
  onChange,
  disabled = false,
}: EntityUsernameInputProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SearchOption[]>([]);

  const query = value.trim().replace(/^@/, "").toLowerCase();

  useEffect(() => {
    if (query.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [usersRes, personasRes] = await Promise.all([
          fetch(`/api/search?type=users&q=${encodeURIComponent(query)}`),
          fetch(`/api/search?type=personas&q=${encodeURIComponent(query)}`),
        ]);

        const usersJson = usersRes.ok ? await usersRes.json() : [];
        const personasJson = personasRes.ok ? await personasRes.json() : [];
        const users = Array.isArray(usersJson) ? usersJson : [];
        const personas = Array.isArray(personasJson) ? personasJson : [];

        const merged = [
          ...users
            .map((item) => normalizeSearchResult(item, "profile"))
            .filter((item): item is SearchOption => item !== null),
          ...personas
            .map((item) => normalizeSearchResult(item, "persona"))
            .filter((item): item is SearchOption => item !== null),
        ];

        const deduped = Array.from(
          new Map(merged.map((item) => [item.username.toLowerCase(), item])).values(),
        );

        if (!cancelled) {
          setOptions(deduped.slice(0, 10));
        }
      } catch {
        if (!cancelled) {
          setOptions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const showDropdown = open && (loading || options.length > 0 || query.length >= 2);
  const selectedUsername = useMemo(() => value.trim().replace(/^@/, "").toLowerCase(), [value]);

  return (
    <div className="relative">
      <input
        className="input input-bordered bg-base-100 border-neutral w-full"
        placeholder="Username (persona uses ai_ prefix)"
        value={value}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          onChange(event.target.value.toLowerCase());
          setOpen(true);
        }}
      />

      {showDropdown ? (
        <div className="bg-base-100 border-base-300 absolute z-[120] mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-xl">
          {loading ? (
            <div className="px-3 py-2 text-sm opacity-70">Searching...</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-sm opacity-70">No matches</div>
          ) : (
            options.map((option) => {
              const active = option.username.toLowerCase() === selectedUsername;
              return (
                <button
                  key={`${option.entityType}:${option.username}`}
                  type="button"
                  className={`hover:bg-base-200 flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    active ? "bg-base-200" : ""
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(option.username);
                    setOpen(false);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar
                      src={option.avatarUrl || undefined}
                      fallbackSeed={option.username}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{option.displayName}</span>
                      <span className="block truncate text-xs opacity-60">@{option.username}</span>
                    </span>
                  </span>
                  <span className="badge badge-ghost badge-xs">{option.entityType}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
