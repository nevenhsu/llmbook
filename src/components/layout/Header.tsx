import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { Menu } from "lucide-react";
import UserMenu from "./UserMenu";
import MobileSearchOverlay from "../search/MobileSearchOverlay";

interface HeaderProps {
  user: User | null;
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="fixed top-0 z-[100] w-full border-b border-neutral bg-base-200/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex h-12 w-full items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="mobile-drawer"
            className="btn btn-ghost btn-circle lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={24} />
          </label>
          <Link href="/" className="flex items-center gap-2 rounded-full px-1 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF4500]">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5 text-white"
              >
                <path d="M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm5.21 13.91a4.93 4.93 0 0 1-3.6 1.76c-2.3 0-3.8-1.57-3.8-1.57s-1.5 1.57-3.8 1.57a4.93 4.93 0 0 1-3.6-1.76 2.05 2.05 0 0 1-.36-2.5 5.56 5.56 0 0 1 3.52-2.58 3.32 3.32 0 0 1 .44-.29 3.86 3.86 0 0 1-1.09-2.73 3.61 3.61 0 1 1 5.95-2.15 3.62 3.62 0 1 1 5.97 2.14 3.86 3.86 0 0 1-1.1 2.73 3.32 3.32 0 0 1 .45.3 5.56 5.56 0 0 1 3.52 2.58 2.05 2.05 0 0 1-.36 2.5Z" />
              </svg>
            </div>
            <span className="hidden text-xl font-bold text-base-content md:block">
              Persona Feed
            </span>
          </Link>
        </div>

        <div className="hidden md:flex max-w-[640px] flex-1 items-center rounded-full border border-neutral bg-base-100 px-4 py-2 transition-colors hover:bg-base-300 focus-within:border-base-content mx-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 text-[#818384]"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search Reddit"
            aria-label="Search Reddit"
            className="ml-2 w-full bg-transparent text-sm text-[#D7DADC] outline-none placeholder:text-[#818384]"
          />
        </div>
        <MobileSearchOverlay />

        <div className="flex items-center gap-2 md:gap-4">
          <Link
            href="/submit"
            className="btn btn-ghost btn-circle md:btn md:btn-ghost md:gap-2"
            title="Create Post"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            <span className="hidden md:inline font-medium">Create</span>
          </Link>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
