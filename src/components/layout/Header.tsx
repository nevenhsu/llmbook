import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { Menu, Plus } from "lucide-react";
import UserMenu from "./UserMenu";
import MobileSearchOverlay from "../search/MobileSearchOverlay";
import SearchBar from "../search/SearchBar";
import NotificationBell from "../notification/NotificationBell";

interface HeaderProps {
  user: User | null;
  profile?: { display_name: string; avatar_url: string | null; username: string | null } | null;
}

export default function Header({ user, profile }: HeaderProps) {
  return (
    <header className="border-neutral fixed top-0 z-[100] w-full border-b px-3 py-2 backdrop-blur">
      <div className="mx-auto flex h-12 w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="mobile-drawer"
            className="hover:hover:bg-base-300 cursor-pointer rounded-full p-2 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={24} />
          </label>
          <Link href="/" className="flex items-center gap-2 rounded-full px-1 py-1">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
              <svg viewBox="0 0 20 20" fill="currentColor" className="text-primary-content h-5 w-5">
                <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm5.21 13.91a4.93 4.93 0 0 1-3.6 1.76c-2.3 0-3.8-1.57-3.8-1.57s-1.5 1.57-3.8 1.57a4.93 4.93 0 0 1-3.6-1.76 2.05 2.05 0 0 1-.36-2.5 5.56 5.56 0 0 1 3.52-2.58 3.32 3.32 0 0 1 .44-.29 3.86 3.86 0 0 1-1.09-2.73 3.61 3.61 0 1 1 5.95-2.15 3.62 3.62 0 1 1 5.97 2.14 3.86 3.86 0 0 1-1.1 2.73 3.32 3.32 0 0 1 .45.3 5.56 5.56 0 0 1 3.52 2.58 2.05 2.05 0 0 1-.36 2.5Z" />
              </svg>
            </div>
            <span className="text-base-content font-display hidden text-xl font-bold md:block">
              Persona Feed
            </span>
          </Link>
        </div>

        <div className="mx-4 hidden flex-1 justify-center md:flex">
          <SearchBar />
        </div>
        <MobileSearchOverlay />

        <div className="flex items-center gap-2 md:gap-4">
          {user && (
            <>
              <Link
                href="/new"
                className="hover:hover:bg-base-300 flex items-center gap-2 rounded-full p-2 md:px-4"
                title="Create Post"
              >
                <Plus size={22} />
                <span className="hidden font-medium md:block">Create</span>
              </Link>
              <NotificationBell />
            </>
          )}
          <UserMenu user={user} profile={profile} />
        </div>
      </div>
    </header>
  );
}
