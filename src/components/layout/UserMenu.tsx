"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Image from "next/image";
import {
  ChevronDown,
  User,
  Paintbrush,
  Moon,
  LogOut,
} from "lucide-react";

interface UserMenuProps {
  user: SupabaseUser | null;
  profile?: { display_name: string; avatar_url: string | null } | null;
}

export default function UserMenu({ user, profile }: UserMenuProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!user) {
    return (
      <Link
        href="/login"
        className="bg-upvote text-white px-4 py-1.5 rounded-full text-sm font-bold hover:bg-opacity-90"
      >
        Log In
      </Link>
    );
  }

  const username = profile?.display_name || user.email?.split("@")[0] || "User";
  const avatarUrl = (profile?.avatar_url && profile.avatar_url.trim() !== "") 
    ? profile.avatar_url 
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.id || username)}`;

  return (
    <div className="dropdown dropdown-end relative">
      <div tabIndex={0} role="button" className="flex items-center gap-2 p-1 md:p-2 rounded-md hover:bg-surface-hover cursor-pointer">
        <div className="relative h-6 w-6 overflow-hidden rounded-full bg-surface">
          <Image
            src={avatarUrl}
            alt="User Avatar"
            fill
            className="object-cover"
            sizes="24px"
            unoptimized={avatarUrl.endsWith('.svg') || avatarUrl.includes('dicebear')}
          />
        </div>
        <div className="hidden flex-col items-start text-xs md:flex">
          <span className="font-semibold text-text-primary">{username}</span>
          <span className="text-text-secondary">1 karma</span>
        </div>
        <ChevronDown size={16} className="text-text-secondary" />
      </div>
      <ul
        tabIndex={-1}
        className="dropdown-content absolute right-0 mt-2 w-64 bg-surface border border-border-default rounded-md shadow-lg z-50 py-2"
      >
        <li>
          <Link href="/profile" className="flex items-center gap-3 px-4 py-2 hover:bg-surface-hover text-sm text-text-primary">
            <User size={18} className="text-text-secondary" /> View Profile
          </Link>
        </li>
        <li>
          <Link href="/settings/profile" className="flex items-center gap-3 px-4 py-2 hover:bg-surface-hover text-sm text-text-primary">
            <Paintbrush size={18} className="text-text-secondary" /> Edit Avatar
          </Link>
        </li>
        <li>
          <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-hover text-sm text-text-primary text-left">
            <Moon size={18} className="text-text-secondary" /> Display Mode
          </button>
        </li>
        <div className="border-t border-border-default my-1"></div>
        <li>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-hover text-sm text-text-primary text-left">
            <LogOut size={18} className="text-text-secondary" /> Log Out
          </button>
        </li>
      </ul>
    </div>
  );
}
