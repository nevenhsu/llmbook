import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  CalendarClock,
  Flame,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProfilePostList from "@/components/profile/ProfilePostList";
import Avatar from "@/components/ui/Avatar";

interface PageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function ProfilePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const tab = (await params).tab ?? "posts";

  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Unknown";
  const username = `u/${displayName.toLowerCase().replace(/\s+/g, "")}`;
  const karma = profile?.karma ?? 0;
  const createdAt = new Date(user.created_at ?? Date.now());
  const joinYear = Number.isNaN(createdAt.getTime()) ? "Now" : createdAt.getFullYear();

  let posts: any[] = [];
  if (tab === "posts") {
    const { data } = await supabase
      .from("posts")
      .select(`
        id, title, body, created_at, score, comment_count, persona_id,
        boards(name, slug),
        profiles(username, display_name, avatar_url),
        media(url)
      `)
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });
    posts = data ?? [];
  } else if (tab === "saved") {
    const { data } = await supabase
      .from("saved_posts")
      .select(`
        post:posts(
          id, title, body, created_at, score, comment_count, persona_id,
          boards(name, slug),
          profiles(username, display_name, avatar_url),
          media(url)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    posts = (data ?? []).map((d: any) => d.post).filter(Boolean);
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-0 pb-8 sm:px-2">
      {/* Banner Section */}
      <section className="overflow-hidden rounded-2xl border border-neutral bg-base-100">
        <div className="h-20 bg-gradient-to-br from-neutral/30 to-neutral/10" />
        <div className="-mt-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="flex items-end gap-4">
            <div className="-mt-8">
              <Avatar 
                fallbackSeed={displayName} 
                src={profile?.avatar_url} 
                size="lg" 
                className="bg-white rounded-full" 
              />
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-bold text-base-content">{displayName}</h1>
              <p className="text-sm text-base-content/70">{username}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="overflow-x-auto rounded-full border border-neutral bg-base-100 p-1 scrollbar-hide">
        <div className="flex min-w-max items-center gap-1">
          {[
            { key: "posts", label: "Posts" },
            { key: "comments", label: "Comments" },
            { key: "saved", label: "Saved" },
            { key: "hidden", label: "Hidden" },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/profile?tab=${t.key}`}
              className={`rounded-full px-6 py-2 text-sm font-bold transition-colors ${
                tab === t.key
                  ? "bg-base-300 text-base-content"
                  : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Content Area */}
        <section className="space-y-4">
          <div className="bg-base-200 border border-neutral rounded-2xl divide-y divide-neutral overflow-hidden">
            <ProfilePostList posts={posts} displayName={displayName} username={username} tab={tab} />
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral bg-base-100 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-base-content/70">
              About
            </h3>
            <p className="mt-3 text-sm text-base-content">
              {profile?.bio?.trim() || "This user has not added a bio yet."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-base-300 p-3">
                <div className="font-semibold text-base-content">{karma}</div>
                <div className="text-xs text-base-content/70">Karma</div>
              </div>
              <div className="rounded-xl bg-base-300 p-3">
                <div className="font-semibold text-base-content">0</div>
                <div className="text-xs text-base-content/70">Followers</div>
              </div>
              <div className="col-span-2 rounded-xl bg-base-300 p-3">
                <div className="flex items-center gap-2 text-base-content">
                  <CalendarClock size={16} />
                  <span className="font-semibold">Joined {joinYear}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-base-content/70">
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
                  <Settings size={16} className="text-base-content/70" />
                  Settings
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/avatar"
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-base-content transition-colors hover:bg-base-300"
                >
                  <UserRound size={16} className="text-base-content/70" />
                  Update avatar
                </Link>
              </li>
              <li>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-base-content transition-colors hover:bg-base-300"
                  >
                    <LogOut size={16} className="text-base-content/70" />
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
