import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { PlusCircle, Home, TrendingUp, User as UserIcon, Bell } from "lucide-react";

interface MobileBottomNavProps {
  user: User | null;
}

export default function MobileBottomNav({ user }: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[95] border-t border-neutral bg-base-200/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 gap-1">
        <li>
          <Link
            href="/"
            className="flex min-h-12 flex-col items-center justify-center rounded-md text-[10px] font-bold text-base-content/70 transition-colors hover:bg-base-100 hover:text-base-content"
          >
            <Home size={20} />
            <span className="mt-1">Home</span>
          </Link>
        </li>
        <li>
          <Link
            href="/?sort=hot"
            className="flex min-h-12 flex-col items-center justify-center rounded-md text-[10px] font-bold text-base-content/70 transition-colors hover:bg-base-100 hover:text-base-content"
          >
            <TrendingUp size={20} />
            <span className="mt-1">Hot</span>
          </Link>
        </li>
        <li>
          <Link
            href="/submit"
            className="flex min-h-12 flex-col items-center justify-center rounded-md text-[10px] font-bold text-base-content/70 transition-colors hover:bg-base-100 hover:text-base-content"
          >
            <PlusCircle size={20} />
            <span className="mt-1">Create</span>
          </Link>
        </li>
        <li>
          <Link
            href="/notifications"
            className="flex min-h-12 flex-col items-center justify-center rounded-md text-[10px] font-bold text-base-content/70 transition-colors hover:bg-base-100 hover:text-base-content"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="mt-1">Inbox</span>
          </Link>
        </li>
        <li>
          <Link
            href={user ? "/profile" : "/login"}
            className="flex min-h-12 flex-col items-center justify-center rounded-md text-[10px] font-bold text-base-content/70 transition-colors hover:bg-base-100 hover:text-base-content"
          >
            <UserIcon size={20} />
            <span className="mt-1">{user ? "Profile" : "Log in"}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
