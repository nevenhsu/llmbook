"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Image from "next/image";
import { ChevronDown, User, Paintbrush, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface UserMenuProps {
  user: SupabaseUser | null;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    username: string | null;
    karma?: number;
  } | null;
}

export default function UserMenu({ user, profile }: UserMenuProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="btn btn-ghost btn-circle"
          aria-label="Toggle theme"
        >
          {theme === "black" ? (
            <Sun size={20} className="text-base-content" />
          ) : (
            <Moon size={20} className="text-base-content" />
          )}
        </button>
        <Link
          href="/login"
          className="btn btn-primary btn-sm rounded-full"
        >
          Log In
        </Link>
      </div>
    );
  }

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "User";
  const username =
    profile?.username || displayName.toLowerCase().replace(/\s+/g, "");
  const avatarUrl =
    profile?.avatar_url && profile.avatar_url.trim() !== ""
      ? profile.avatar_url
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.id || displayName)}`;

  return (
    <div className="dropdown dropdown-end relative">
      <div
        tabIndex={0}
        role="button"
        className="flex items-center gap-2 p-1 md:p-2 rounded-md hover:hover:bg-base-300 cursor-pointer"
      >
        <div className="relative h-6 w-6 overflow-hidden rounded-full bg-white">
          <Image
            src={avatarUrl}
            alt="User Avatar"
            fill
            className="object-cover"
            sizes="24px"
            unoptimized={
              avatarUrl.endsWith(".svg") || avatarUrl.includes("dicebear")
            }
          />
        </div>
        <div className="hidden flex-col items-start text-xs md:flex">
          <span className="font-semibold text-base-content">{displayName}</span>
          <span className="text-base-content/70">{profile?.karma || 0} karma</span>
        </div>
        <ChevronDown size={16} className="text-base-content/70" />
      </div>
      <ul
        tabIndex={-1}
        className="dropdown-content absolute right-0 mt-2 w-64 bg-base-100 border border-neutral rounded-md shadow-lg z-50 py-2"
        onClick={(e) => {
          // DaisyUI dropdown stays open via :focus-within; blur the focused item to close.
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
      >
        <li>
          <Link
            href={`/u/${username}`}
            className="flex items-center gap-3 px-4 py-2 hover:hover:bg-base-300 text-sm text-base-content"
          >
            <User size={18} className="text-base-content/70" /> View Profile
          </Link>
        </li>
        <li>
          <Link
            href="/settings/avatar"
            className="flex items-center gap-3 px-4 py-2 hover:hover:bg-base-300 text-sm text-base-content"
          >
            <Paintbrush size={18} className="text-base-content/70" /> Edit
            Avatar
          </Link>
        </li>
        <li>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2 hover:hover:bg-base-300 text-sm text-base-content text-left"
          >
            {theme === "black" ? (
              <Sun size={18} className="text-base-content/70" />
            ) : (
              <Moon size={18} className="text-base-content/70" />
            )}
            Display Mode
          </button>
        </li>
        <div className="border-t border-neutral my-1"></div>
        <li>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2 hover:hover:bg-base-300 text-sm text-base-content text-left"
          >
            <LogOut size={18} className="text-base-content/70" /> Log Out
          </button>
        </li>
      </ul>
    </div>
  );
}
