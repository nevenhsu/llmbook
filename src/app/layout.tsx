import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";

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

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B1416] text-[#D7DADC]">
        <Header user={user} />
        <div className="pt-16">
          <div className="mx-auto flex max-w-[1600px] justify-center px-0 lg:px-4">
            <LeftSidebar />
            <main className="min-w-0 flex-1 py-4 lg:px-4">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
