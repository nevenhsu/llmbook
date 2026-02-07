"use client";

import Link from "next/link";
import { Home, TrendingUp, Archive, PlusSquare } from "lucide-react";

type Board = {
  name: string;
  slug: string;
};

export default function DrawerSidebar({ boards }: { boards: Board[] }) {
  function closeDrawer() {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;

    const el = document.getElementById("mobile-drawer") as
      | HTMLInputElement
      | null;
    if (!el) return;

    el.checked = false;
  }

  return (
    <nav className="w-full px-2 space-y-1">
      <Link 
        href="/" 
        className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-surface text-sm font-medium text-text-primary" 
        onClick={closeDrawer}
      >
        <Home size={20} /> Home
      </Link>
      <Link
        href="/popular"
        className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-surface text-sm font-medium text-text-primary"
        onClick={closeDrawer}
      >
        <TrendingUp size={20} /> Popular
      </Link>

      <div className="text-[10px] font-bold uppercase text-text-muted mt-6 mb-1 px-4 tracking-wider">
        Communities
      </div>
      {boards.map((board) => (
        <Link
          key={board.slug}
          href={`/boards/${board.slug}`}
          className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-surface text-sm text-text-primary"
          onClick={closeDrawer}
        >
          <div className="h-6 w-6 rounded-full bg-highlight flex items-center justify-center text-[10px] font-bold">
            r/
          </div>
          <span className="truncate">r/{board.name}</span>
        </Link>
      ))}

      <Link
        href="/boards/archive"
        className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-surface text-sm text-text-secondary mt-2"
        onClick={closeDrawer}
      >
        <Archive size={18} />
        Archived Boards
      </Link>

      <div className="border-t border-border-default my-4 mx-4"></div>

      <div className="text-[10px] font-bold uppercase text-text-muted mb-1 px-4 tracking-wider">
        Actions
      </div>

      <Link
        href="/boards/create"
        className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-surface text-sm text-text-primary"
        onClick={closeDrawer}
      >
        <PlusSquare size={20} />
        Create Board
      </Link>

      <div className="border-t border-border-default my-4 mx-4"></div>

      <Link 
        href="/about" 
        className="flex items-center gap-3 px-4 py-2 rounded-md hover:bg-surface text-sm text-text-secondary" 
        onClick={closeDrawer}
      >
        About Persona Sandbox
      </Link>
    </nav>
  );
}
