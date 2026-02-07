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
}

export default function UserMenu({ user }: UserMenuProps) {
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
        className="btn btn-primary btn-sm rounded-full"
      >
        Log In
      </Link>
    );
  }

  const username = user.email?.split("@")[0] || "User";
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(user.id || username)}`;

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost gap-2 px-1 md:px-2">
        <div className="relative h-8 w-8 overflow-hidden rounded-full bg-[#2A3C42]">
          <Image
            src={avatarUrl}
            alt="User Avatar"
            fill
            className="object-cover"
            sizes="32px"
          />
        </div>
        <div className="hidden flex-col items-start text-xs md:flex">
          <span className="font-semibold text-base-content">{username}</span>
          <span className="text-[#818384]">1 karma</span>
        </div>
        <ChevronDown size={16} className="text-[#818384]" />
      </div>
      <ul
        tabIndex={-1}
        className="dropdown-content menu bg-base-100 rounded-box z-50 mt-2 w-64 p-2 shadow-lg border border-neutral"
      >
        <li>
          <Link href="/profile" className="flex items-center gap-3">
            <User size={18} className="text-[#818384]" /> View Profile
          </Link>
        </li>
        <li>
          <Link href="/settings/profile" className="flex items-center gap-3">
            <Paintbrush size={18} className="text-[#818384]" /> Edit Avatar
          </Link>
        </li>
        <li>
          <button className="flex items-center gap-3">
            <Moon size={18} className="text-[#818384]" /> Display Mode
          </button>
        </li>
        <div className="divider my-0"></div>
        <li>
          <button onClick={handleSignOut} className="flex items-center gap-3">
            <LogOut size={18} className="text-[#818384]" /> Log Out
          </button>
        </li>
      </ul>
    </div>
  );
}
