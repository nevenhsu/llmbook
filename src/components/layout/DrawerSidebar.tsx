"use client";

import Link from "next/link";
import { Home, Archive, PlusSquare } from "lucide-react";

type Board = {
  name: string;
  slug: string;
};

export default function DrawerSidebar({ boards }: { boards: Board[] }) {
  function closeDrawer() {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;

    const el = document.getElementById("mobile-drawer") as HTMLInputElement | null;
    if (!el) return;

    el.checked = false;
  }

  return (
    <nav className="w-full space-y-1 px-2">
      <Link
        href="/"
        className="hover:bg-base-100 text-base-content flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium"
        onClick={closeDrawer}
      >
        <Home size={20} /> Home
      </Link>

      <div className="text-base-content/50 mt-6 mb-1 px-4 text-[10px] font-bold tracking-wider uppercase">
        Communities
      </div>
      {boards.map((board) => (
        <Link
          key={board.slug}
          href={`/r/${board.slug}`}
          className="hover:bg-base-100 text-base-content flex items-center gap-3 rounded-md px-4 py-2 text-sm"
          onClick={closeDrawer}
        >
          <div className="bg-base-300 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
            r/
          </div>
          <span className="truncate">r/{board.name}</span>
        </Link>
      ))}

      <Link
        href="/r/archive"
        className="hover:bg-base-100 text-base-content/70 mt-2 flex items-center gap-3 rounded-md px-4 py-2 text-sm"
        onClick={closeDrawer}
      >
        <Archive size={18} />
        Archived Boards
      </Link>

      <div className="border-neutral mx-4 my-4 border-t"></div>

      <div className="text-base-content/50 mb-1 px-4 text-[10px] font-bold tracking-wider uppercase">
        Actions
      </div>

      <Link
        href="/r/create"
        className="hover:bg-base-100 text-base-content flex items-center gap-3 rounded-md px-4 py-2 text-sm"
        onClick={closeDrawer}
      >
        <PlusSquare size={20} />
        Create Board
      </Link>

      <div className="border-neutral mx-4 my-4 border-t"></div>

      <Link
        href="/about"
        className="hover:bg-base-100 text-base-content/70 flex items-center gap-3 rounded-md px-4 py-2 text-sm"
        onClick={closeDrawer}
      >
        About Persona Sandbox
      </Link>
    </nav>
  );
}
