import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  CalendarClock,
  Flame,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,avatar_url,bio")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "Unknown";
  const username = `u/${displayName.toLowerCase().replace(/\s+/g, "")}`;
  const createdAt = new Date(user.created_at ?? Date.now());
  const joinYear = Number.isNaN(createdAt.getTime())
    ? "Now"
    : createdAt.getFullYear();

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-0 pb-8 sm:px-2">
      <section className="overflow-hidden rounded-2xl border border-neutral bg-base-100">
        <div className="h-20 bg-gradient-to-r from-[#171f2a] via-[#1d2d4a] to-[#2e5ca8]" />
        <div className="-mt-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-base-100 bg-base-300 text-xl font-bold text-base-content sm:h-20 sm:w-20">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-base-content sm:text-2xl">
                {displayName}
              </h1>
              <p className="text-sm text-[#818384]">{username}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-full border border-neutral bg-base-100 p-1 scrollbar-hide">
        <div className="flex min-w-max items-center gap-1">
          <button className="rounded-full bg-base-300 px-4 py-2 text-sm font-semibold text-base-content">
            Overview
          </button>
          <button className="rounded-full px-4 py-2 text-sm font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content">
            Posts
          </button>
          <button className="rounded-full px-4 py-2 text-sm font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content">
            Comments
          </button>
          <button className="rounded-full px-4 py-2 text-sm font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content">
            Saved
          </button>
          <button className="rounded-full px-4 py-2 text-sm font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content">
            History
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-dashed border-neutral bg-base-100 px-5 py-14 text-center sm:py-20">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-base-300 text-[#818384]">
              <Sparkles size={24} />
            </div>
            <h2 className="text-lg font-semibold text-base-content">
              No posts yet
            </h2>
            <p className="mt-1 text-sm text-[#818384]">
              {username} 還沒有發文，建立第一篇貼文開始互動。
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral bg-base-100 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#818384]">
              About
            </h3>
            <p className="mt-3 text-sm text-base-content">
              {profile?.bio?.trim() || "This user has not added a bio yet."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-base-300 p-3">
                <div className="font-semibold text-base-content">1</div>
                <div className="text-xs text-[#818384]">Karma</div>
              </div>
              <div className="rounded-xl bg-base-300 p-3">
                <div className="font-semibold text-base-content">0</div>
                <div className="text-xs text-[#818384]">Followers</div>
              </div>
              <div className="col-span-2 rounded-xl bg-base-300 p-3">
                <div className="flex items-center gap-2 text-base-content">
                  <CalendarClock size={16} />
                  <span className="font-semibold">Joined {joinYear}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-[#818384]">
                  <Flame size={14} /> Profile activity will appear here.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral bg-base-100 p-2">
            <ul className="space-y-1">
              <li>
                <Link
                  href="/settings/profile"
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-base-content transition-colors hover:bg-base-300"
                >
                  <Settings size={16} className="text-[#818384]" />
                  Setting
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/avatar"
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-base-content transition-colors hover:bg-base-300"
                >
                  <UserRound size={16} className="text-[#818384]" />
                  Update avatar
                </Link>
              </li>
              <li>
                <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-base-content transition-colors hover:bg-base-300">
                  <Moon size={16} className="text-[#818384]" />
                  Theme
                </button>
              </li>
              <li>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-base-content transition-colors hover:bg-base-300"
                  >
                    <LogOut size={16} className="text-[#818384]" />
                    Log out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
