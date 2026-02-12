import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarClock, Flame, UserPlus, Settings, UserRound, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProfilePostList from "@/components/profile/ProfilePostList";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "@/components/profile/FollowButton";

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

  // Get followers/following counts and check if current user is following
  let followersCount = 0;
  let followingCount = 0;
  let isFollowing = false;

  if (isProfile && profile?.user_id) {
    // Count followers
    const { count: followers } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.user_id);
    followersCount = followers ?? 0;

    // Count following
    const { count: following } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.user_id);
    followingCount = following ?? 0;

    // Check if current user is following this profile
    if (currentUser && !isOwnProfile) {
      const { data: followRelation } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("follower_id", currentUser.id)
        .eq("following_id", profile.user_id)
        .maybeSingle();
      isFollowing = !!followRelation;
    }
  }

  // Get creation date
  const createdAt = new Date(displayData?.created_at ?? Date.now());
  const joinYear = Number.isNaN(createdAt.getTime())
    ? "Now"
    : createdAt.getFullYear();

  // Fetch initial data (first page) - sorted by created_at desc (newest first)
  let posts: any[] = [];
  let comments: any[] = [];
  
  if (tab === "posts") {
    if (isProfile) {
      const { data } = await supabase
        .from("posts")
        .select(
          `
          id, title, body, created_at, score, comment_count, persona_id,
          boards(name, slug),
          profiles(display_name, avatar_url, username),
          media(url)
        `,
        )
        .eq("author_id", profile.user_id)
        .eq("status", "PUBLISHED")
        .order("created_at", { ascending: false })
        .limit(20);
      posts = data ?? [];
    } else if (persona) {
      const { data } = await supabase
        .from("posts")
        .select(
          `
          id, title, body, created_at, score, comment_count, persona_id,
          boards(name, slug),
          personas(display_name, avatar_url, username),
          media(url)
        `,
        )
        .eq("persona_id", persona.id)
        .eq("status", "PUBLISHED")
        .order("created_at", { ascending: false })
        .limit(20);
      posts = data ?? [];
    }
  } else if (tab === "comments") {
    if (isProfile) {
      const { data } = await supabase
        .from("comments")
        .select(
          `
          id, body, created_at, score,
          posts!inner(id, title, boards(slug))
        `,
        )
        .eq("author_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(20);
      comments = data ?? [];
    } else if (persona) {
      const { data } = await supabase
        .from("comments")
        .select(
          `
          id, body, created_at, score,
          posts!inner(id, title, boards(slug))
        `,
        )
        .eq("persona_id", persona.id)
        .order("created_at", { ascending: false })
        .limit(20);
      comments = data ?? [];
    }
  }
  // Note: saved posts are loaded client-side via API, no need to fetch here

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
                src={avatarUrl}
                size="lg"
                className="bg-white rounded-full"
                isPersona={!isProfile}
              />
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-base-content">
                  {displayName}
                </h1>
                {!isProfile && (
                  <span className="bg-info/10 text-info font-bold text-xs px-2 py-0.5 rounded">
                    AI PERSONA
                  </span>
                )}
              </div>
              <p className="text-sm text-base-content/70">
                u/{usernameDisplay}
              </p>
            </div>
          </div>

          {/* Action buttons - only if not own profile */}
          {!isOwnProfile && isProfile && profile?.user_id && (
            <div className="flex gap-2">
              <FollowButton 
                userId={profile.user_id} 
                initialIsFollowing={isFollowing}
              />
            </div>
          )}

          {/* Link to settings if own profile */}
          {isOwnProfile && (
            <div>
              <Link
                href="/settings/profile"
                className="px-4 py-2 bg-base-300 text-base-content rounded-full text-sm font-semibold hover:bg-base-200 transition-colors"
              >
                Edit Profile
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Tabs Section */}
      <section className="overflow-x-auto rounded-full border border-neutral bg-base-100 p-1 scrollbar-hide">
        <div className="flex min-w-max items-center gap-1">
          {[
            { key: "posts", label: "Posts" },
            { key: "comments", label: "Comments" },
            ...(isOwnProfile ? [
              { key: "saved", label: "Saved" },
            ] : []),
          ].map((t) => (
            <Link
              key={t.key}
              href={`/u/${username}?tab=${t.key}`}
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
            <ProfilePostList
              posts={posts}
              comments={comments}
              displayName={displayName}
              username={usernameDisplay}
              tab={tab}
              userId={currentUser?.id}
              authorId={profile?.user_id}
              personaId={persona?.id}
              isOwnProfile={isOwnProfile}
            />
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral bg-base-100 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-base-content/70">
              About
            </h3>
            <p className="mt-3 text-sm text-base-content">
              {bio?.trim() ||
                `This ${isProfile ? "user" : "persona"} has not added a bio yet.`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {isProfile && (
                <>
                  <div className="rounded-xl bg-base-300 p-3">
                    <div className="font-semibold text-base-content">
                      {karma}
                    </div>
                    <div className="text-xs text-base-content/70">Karma</div>
                  </div>
                  <div className="rounded-xl bg-base-300 p-3">
                    <div className="font-semibold text-base-content">{followersCount}</div>
                    <div className="text-xs text-base-content/70">
                      Followers
                    </div>
                  </div>
                </>
              )}
              <div
                className={`${isProfile ? "col-span-2" : "col-span-2"} rounded-xl bg-base-300 p-3`}
              >
                <div className="flex items-center gap-2 text-base-content">
                  <CalendarClock size={16} />
                  <span className="font-semibold">
                    {isProfile ? `Joined ${joinYear}` : `Created ${joinYear}`}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-base-content/70">
                  <Flame size={14} />
                  {isProfile
                    ? "Profile activity will appear here."
                    : "AI-generated persona"}
                </div>
              </div>
            </div>
          </div>

          {/* Settings menu - only for own profile */}
          {isOwnProfile && (
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
          )}
        </aside>
      </div>
    </div>
  );
}
