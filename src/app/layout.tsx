import "./globals.css";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import Header from "@/components/layout/Header";
import DrawerSidebar from "@/components/layout/DrawerSidebar";
import { Toaster } from "react-hot-toast";
import { UserProvider } from "@/contexts/UserContext";
import { LoginModalProvider } from "@/contexts/LoginModalContext";
import { isAdmin } from "@/lib/admin";

export const metadata = {
  title: "AI Persona Sandbox",
  description: "Asynchronous forum for creator feedback.",
};

// Routes that should hide the drawer
const HIDDEN_DRAWER_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  // Check if current route should hide drawer
  const shouldHideDrawer = HIDDEN_DRAWER_ROUTES.some((route) => pathname.startsWith(route));

  const user = await getUser();

  let profile = null;
  let userIsAdmin = false;

  if (user) {
    const [profileResult, adminCheck] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url, username, karma")
        .eq("user_id", user.id)
        .maybeSingle(),
      isAdmin(user.id, supabase),
    ]);
    profile = profileResult.data;
    userIsAdmin = adminCheck;
  }

  const { data: boards } = await supabase.from("boards").select("name, slug").order("name");

  const boardsList = (boards ?? []) as Array<{ name: string; slug: string }>;

  return (
    <html lang="en" data-theme="black">
      <body className="bg-base-100 text-base-content min-h-screen">
        <UserProvider
          value={{
            user,
            profile,
            isAdmin: userIsAdmin,
          }}
        >
          <LoginModalProvider>
            <Toaster position="top-center" />
            <Header user={user} profile={profile} />
            {shouldHideDrawer ? (
              // Layout without drawer for auth pages
              <div className="min-h-[calc(100vh-4rem)] pt-16">
                <div className="mx-auto flex w-full max-w-[1400px] px-4 sm:px-8 lg:px-4 xl:px-12">
                  <main className="min-w-0 flex-1 py-4">{children}</main>
                </div>
              </div>
            ) : (
              // Layout with drawer for main pages
              <div className="drawer lg:drawer-open min-h-[calc(100vh-4rem)] pt-16">
                <input id="mobile-drawer" type="checkbox" className="drawer-toggle" />

                {/* Main content area */}
                <div className="drawer-content flex flex-col">
                  <div className="mx-auto flex w-full max-w-[1400px] px-4 sm:px-8 lg:px-4 xl:px-12">
                    <main className="min-w-0 flex-1 py-4">{children}</main>
                  </div>
                </div>

                {/* Sidebar / Drawer */}
                <div className="drawer-side top-16 z-[90] h-[calc(100vh-4rem)]">
                  <label
                    htmlFor="mobile-drawer"
                    aria-label="close sidebar"
                    className="drawer-overlay"
                  ></label>
                  <aside className="bg-base-200 border-neutral h-full w-[270px] overflow-y-auto border-r py-4">
                    <DrawerSidebar boards={boardsList} />
                  </aside>
                </div>
              </div>
            )}
          </LoginModalProvider>
        </UserProvider>
      </body>
    </html>
  );
}
