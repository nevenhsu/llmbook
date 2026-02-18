"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Image from "next/image";
import { ChevronDown, User, Paintbrush, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { generateAvatarDataUri } from "@/lib/dicebear";

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
        <Link href="/login" className="btn btn-primary btn-sm rounded-full">
          Log In
        </Link>
      </div>
    );
  }

  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";
  const username = profile?.username || displayName.toLowerCase().replace(/\s+/g, "");
  const avatarUrl =
    profile?.avatar_url && profile.avatar_url.trim() !== ""
      ? profile.avatar_url
      : generateAvatarDataUri(user.id || displayName);

  return (
    <div className="dropdown dropdown-end relative">
      <div
        tabIndex={0}
        role="button"
        className="hover:hover:bg-base-300 flex cursor-pointer items-center gap-2 rounded-md p-1 md:p-2"
      >
        <div className="relative h-6 w-6 overflow-hidden rounded-full bg-white">
          <Image
            src={avatarUrl}
            alt="User Avatar"
            fill
            className="object-cover"
            sizes="24px"
            unoptimized={avatarUrl.startsWith("data:") || avatarUrl.endsWith(".svg")}
          />
        </div>
        <div className="hidden flex-col items-start text-xs md:flex">
          <span className="text-base-content font-semibold">{displayName}</span>
          <span className="text-base-content/70">{profile?.karma || 0} karma</span>
        </div>
        <ChevronDown size={16} className="text-base-content/70" />
      </div>
      <ul
        tabIndex={-1}
        className="dropdown-content bg-base-100 border-neutral absolute right-0 z-50 mt-2 w-64 rounded-md border py-2 shadow-lg"
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
            className="hover:hover:bg-base-300 text-base-content flex items-center gap-3 px-4 py-2 text-sm"
          >
            <User size={18} className="text-base-content/70" /> View Profile
          </Link>
        </li>
        <li>
          <Link
            href="/settings/avatar"
            className="hover:hover:bg-base-300 text-base-content flex items-center gap-3 px-4 py-2 text-sm"
          >
            <Paintbrush size={18} className="text-base-content/70" /> Edit Avatar
          </Link>
        </li>
        <li>
          <button
            onClick={toggleTheme}
            className="hover:hover:bg-base-300 text-base-content flex w-full items-center gap-3 px-4 py-2 text-left text-sm"
          >
            {theme === "black" ? (
              <Sun size={18} className="text-base-content/70" />
            ) : (
              <Moon size={18} className="text-base-content/70" />
            )}
            Display Mode
          </button>
        </li>
        <div className="border-neutral my-1 border-t"></div>
        <li>
          <button
            onClick={handleSignOut}
            className="hover:hover:bg-base-300 text-base-content flex w-full items-center gap-3 px-4 py-2 text-left text-sm"
          >
            <LogOut size={18} className="text-base-content/70" /> Log Out
          </button>
        </li>
      </ul>
    </div>
  );
}
