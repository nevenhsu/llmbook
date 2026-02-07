"use client";

import Link from "next/link";
import { Home, TrendingUp } from "lucide-react";

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
    <nav className="menu w-full px-2">
      <li>
        <Link href="/" className="flex items-center gap-3" onClick={closeDrawer}>
          <Home size={20} /> Home
        </Link>
      </li>
      <li>
        <Link
          href="/popular"
          className="flex items-center gap-3"
          onClick={closeDrawer}
        >
          <TrendingUp size={20} /> Popular
        </Link>
      </li>

      <li className="menu-title text-xs font-semibold uppercase text-[#818384] mt-4">
        Communities
      </li>
      {boards.map((board) => (
        <li key={board.slug}>
          <Link
            href={`/boards/${board.slug}`}
            className="flex items-center gap-3"
            onClick={closeDrawer}
          >
            <div className="h-6 w-6 rounded-full bg-base-300 flex items-center justify-center text-xs">
              r/
            </div>
            r/{board.name}
          </Link>
        </li>
      ))}

      <div className="divider my-2"></div>

      <li>
        <Link href="/about" onClick={closeDrawer}>
          About Persona Sandbox
        </Link>
      </li>
    </nav>
  );
}
