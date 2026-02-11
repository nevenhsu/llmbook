import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import DrawerSidebar from "@/components/layout/DrawerSidebar";
import { Toaster } from "react-hot-toast";

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

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, username")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = data;
  }

  const { data: boards } = await supabase
    .from("boards")
    .select("name, slug")
    .order("name");

  const boardsList = (boards ?? []) as Array<{ name: string; slug: string }>;

  return (
    <html lang="en" data-theme="black">
      <body className="min-h-screen bg-base-100 text-base-content">
        <Toaster position="top-center" />
        <Header user={user} profile={profile} />
        <div className="drawer lg:drawer-open pt-16 min-h-[calc(100vh-4rem)]">
          <input id="mobile-drawer" type="checkbox" className="drawer-toggle" />

          {/* Main content area */}
          <div className="drawer-content flex flex-col">
            <div className="mx-auto flex w-full max-w-[1400px] px-4 sm:px-8 lg:px-4 xl:px-12">
              <main className="min-w-0 flex-1 py-4">{children}</main>
            </div>
          </div>

          {/* Sidebar / Drawer */}
          <div className="drawer-side z-[90] top-16 h-[calc(100vh-4rem)]">
            <label
              htmlFor="mobile-drawer"
              aria-label="close sidebar"
              className="drawer-overlay"
            ></label>
            <aside className="bg-base-200 h-full w-[270px] overflow-y-auto border-r border-neutral py-4">
              <DrawerSidebar boards={boardsList} />
            </aside>
          </div>
        </div>
      </body>
    </html>
  );
}
