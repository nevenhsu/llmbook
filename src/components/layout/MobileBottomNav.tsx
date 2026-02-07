import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { CirclePlus, House, Trophy, UserRound, Bell } from "lucide-react";

interface MobileBottomNavProps {
  user: User | null;
}

export default function MobileBottomNav({ user }: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[95] border-t border-neutral bg-base-100/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 gap-1">
        <li>
          <Link
            href="/"
            className="flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
          >
            <House size={18} />
            Home
          </Link>
        </li>
        <li>
          <Link
            href="/popular"
            className="flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
          >
            <Trophy size={18} />
            Popular
          </Link>
        </li>
        <li>
          <Link
            href="/submit"
            className="flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
          >
            <CirclePlus size={18} />
            Create
          </Link>
        </li>
        <li>
          <Link
            href="/notifications"
            className="flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
            aria-label="Notifications"
          >
            <Bell size={18} />
            Inbox
          </Link>
        </li>
        <li>
          <Link
            href={user ? "/profile" : "/login"}
            className="flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
          >
            <UserRound size={18} />
            {user ? "Profile" : "Log in"}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
