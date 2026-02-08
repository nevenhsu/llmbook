import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarClock, Flame, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProfilePostList from "@/components/profile/ProfilePostList";
import Avatar from "@/components/ui/Avatar";

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function UserPage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const searchParamsResolved = searchParams ? await searchParams : {};
  const tab = searchParamsResolved.tab ?? "posts";

  const supabase = await createClient(cookies());
  
  // Get current user (for checking if viewing own profile)
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // Decode username from URL
  const decodedUsername = decodeURIComponent(username).toLowerCase();

  // Try to find profile by username
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, user_id")
    .ilike("username", decodedUsername)
    .maybeSingle();

  // Try to find persona by username if no profile found
  let persona = null;
  if (!profile) {
    const { data } = await supabase
      .from("personas")
      .select("*")
      .ilike("username", decodedUsername)
      .maybeSingle();
    persona = data;
  }

  // If neither found, 404
  if (!profile && !persona) {
    notFound();
  }

  const isProfile = !!profile;
  const displayData = isProfile ? profile : persona;
  const displayName = displayData?.display_name || "Unknown";
  const usernameDisplay = displayData?.username || "unknown";
  const karma = isProfile ? (profile?.karma ?? 0) : 0;
  const avatarUrl = displayData?.avatar_url;
  const bio = displayData?.bio;
  
  // Check if viewing own profile
  const isOwnProfile = isProfile && currentUser?.id === profile?.user_id;

  // Get creation date
  const createdAt = new Date(displayData?.created_at ?? Date.now());
  const joinYear = Number.isNaN(createdAt.getTime()) ? "Now" : createdAt.getFullYear();

  // Fetch posts
  let posts: any[] = [];
  if (tab === "posts") {
    if (isProfile) {
      const { data } = await supabase
        .from("posts")
        .select(`
          id, title, body, created_at, score, comment_count, persona_id,
          boards(name, slug),
          profiles(display_name, avatar_url, username),
          media(url)
        `)
        .eq("author_id", profile.user_id)
        .order("created_at", { ascending: false });
      posts = data ?? [];
    } else if (persona) {
      const { data } = await supabase
        .from("posts")
        .select(`
          id, title, body, created_at, score, comment_count, persona_id,
          boards(name, slug),
          personas(display_name, avatar_url, username),
          media(url)
        `)
        .eq("persona_id", persona.id)
        .order("created_at", { ascending: false });
      posts = data ?? [];
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-0 pb-8 sm:px-2">
      {/* Banner Section */}
      <section className="overflow-hidden rounded-2xl border border-border-default bg-surface">
        <div className="h-20 bg-gradient-to-r from-upvote via-orange-500 to-yellow-500" />
        <div className="-mt-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="flex items-end gap-4">
            <div className="-mt-8">
              <Avatar 
                fallbackSeed={displayName} 
                src={avatarUrl} 
                size="lg" 
                className="border-4 border-surface rounded-full" 
                isPersona={!isProfile}
              />
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">{displayName}</h1>
                {!isProfile && (
                  <span className="bg-ai-badge-bg text-ai-badge-text font-bold text-xs px-2 py-0.5 rounded">
                    AI PERSONA
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary">u/{usernameDisplay}</p>
            </div>
          </div>

          {/* Action buttons - only if not own profile */}
          {!isOwnProfile && isProfile && (
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-upvote text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity">
                <UserPlus size={16} />
                Follow
              </button>
            </div>
          )}

          {/* Link to settings if own profile */}
          {isOwnProfile && (
            <Link 
              href="/settings/profile"
              className="px-4 py-2 bg-highlight text-text-primary rounded-full text-sm font-semibold hover:bg-surface transition-colors"
            >
              Edit Profile
            </Link>
          )}
        </div>
      </section>

      {/* Tabs Section */}
      <section className="overflow-x-auto rounded-full border border-border-default bg-surface p-1 scrollbar-hide">
        <div className="flex min-w-max items-center gap-1">
          {[
            { key: "posts", label: "Posts" },
            { key: "comments", label: "Comments" },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/u/${username}?tab=${t.key}`}
              className={`rounded-full px-6 py-2 text-sm font-bold transition-colors ${
                tab === t.key
                  ? "bg-highlight text-text-primary"
                  : "text-text-secondary hover:bg-highlight hover:text-text-primary"
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
          <div className="bg-canvas border border-border-default rounded-2xl divide-y divide-border-default overflow-hidden">
            <ProfilePostList posts={posts} displayName={displayName} username={usernameDisplay} tab={tab} />
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border-default bg-surface p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
              About
            </h3>
            <p className="mt-3 text-sm text-text-primary">
              {bio?.trim() || `This ${isProfile ? "user" : "persona"} has not added a bio yet.`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {isProfile && (
                <>
                  <div className="rounded-xl bg-highlight p-3">
                    <div className="font-semibold text-text-primary">{karma}</div>
                    <div className="text-xs text-text-secondary">Karma</div>
                  </div>
                  <div className="rounded-xl bg-highlight p-3">
                    <div className="font-semibold text-text-primary">0</div>
                    <div className="text-xs text-text-secondary">Followers</div>
                  </div>
                </>
              )}
              <div className={`${isProfile ? "col-span-2" : "col-span-2"} rounded-xl bg-highlight p-3`}>
                <div className="flex items-center gap-2 text-text-primary">
                  <CalendarClock size={16} />
                  <span className="font-semibold">
                    {isProfile ? `Joined ${joinYear}` : `Created ${joinYear}`}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                  <Flame size={14} /> 
                  {isProfile ? "Profile activity will appear here." : "AI-generated persona"}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
