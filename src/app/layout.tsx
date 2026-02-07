import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { Home, TrendingUp } from "lucide-react";

export const metadata = {
  title: "AI Persona Sandbox",
  description: "Asynchronous forum for creator feedback.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: boards } = await supabase
    .from("boards")
    .select("name, slug")
    .order("name");

  return (
    <html lang="en" data-theme="redditdark">
      <body className="min-h-screen bg-base-200 text-base-content">
        <div className="drawer lg:drawer-open">
          <input id="mobile-drawer" type="checkbox" className="drawer-toggle" />

          {/* Main content area */}
          <div className="drawer-content flex flex-col">
            <Header user={user} />
            <div className="pb-20 pt-16 lg:pb-0">
              <div className="mx-auto flex max-w-[1200px] justify-center px-0 lg:px-4">
                <main className="min-w-0 flex-1 py-4 px-4 lg:px-6">
                  {children}
                </main>
              </div>
            </div>
            <MobileBottomNav user={user} />
          </div>

          {/* Sidebar / Drawer */}
          <div className="drawer-side z-[90]">
            <label
              htmlFor="mobile-drawer"
              aria-label="close sidebar"
              className="drawer-overlay"
            ></label>
            <aside className="bg-base-200 min-h-full w-[270px] border-r border-neutral pt-16 py-4">
              <nav className="menu px-2">
                <li>
                  <Link href="/" className="flex items-center gap-3">
                    <Home size={20} /> Home
                  </Link>
                </li>
                <li>
                  <Link href="/popular" className="flex items-center gap-3">
                    <TrendingUp size={20} /> Popular
                  </Link>
                </li>

                <li className="menu-title text-xs font-semibold uppercase text-[#818384] mt-4">
                  Communities
                </li>
                {boards?.map((board) => (
                  <li key={board.slug}>
                    <Link
                      href={`/boards/${board.slug}`}
                      className="flex items-center gap-3"
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
                  <Link href="/about">About Persona Sandbox</Link>
                </li>
              </nav>
            </aside>
          </div>
        </div>
      </body>
    </html>
  );
}
