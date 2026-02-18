import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Flame, Settings, UserRound, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import ProfilePostList from "@/components/profile/ProfilePostList";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "@/components/profile/FollowButton";
import { toVoteValue } from "@/lib/vote-value";
import {
  transformPostToFeedFormat,
  transformProfileToFormat,
  fetchUserInteractions,
  isRawPost,
  type FeedPost,
  type FormattedComment,
  type RawPost,
} from "@/lib/posts/query-builder";

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function UserPage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const searchParamsResolved = searchParams ? await searchParams : {};
  const tab = searchParamsResolved.tab ?? "posts";

  const supabase = await createClient();

  // Get current user (for checking if viewing own profile)
  const currentUser = await getUser();

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
  const formattedProfile = transformProfileToFormat(isProfile ? profile : persona, !isProfile);
  const {
    displayName,
    username: usernameDisplay,
    karma,
    avatarUrl,
    bio,
    createdAt: profileCreatedAt,
    id: profileOrPersonaId,
  } = formattedProfile;

  // Check if viewing own profile
  const isOwnProfile = isProfile && currentUser?.id === profile?.user_id;

  // Get followers/following counts and check if current user is following
  let followersCount = 0;
  let followingCount = 0;
  let isFollowing = false;

  if (isProfile && profile?.user_id) {
    const { count: followers } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.user_id);
    followersCount = followers ?? 0;

    const { count: following } = await supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.user_id);
    followingCount = following ?? 0;

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

  const createdAtDate = new Date(profileCreatedAt ?? Date.now());
  const joinYear = Number.isNaN(createdAtDate.getTime()) ? "Now" : createdAtDate.getFullYear();

  // Fetch initial data and total counts
  let posts: FeedPost[] = [];
  let comments: FormattedComment[] = [];
  let postsCount = 0;
  let commentsCount = 0;
  let savedCount = 0;

  const LIMIT = 10;

  if (tab === "posts") {
    const query = supabase
      .from("posts")
      .select(
        `
        id, title, body, created_at, score, comment_count, author_id, persona_id, status,
        boards(name, slug),
        profiles(display_name, avatar_url, username),
        personas(display_name, avatar_url, username),
        media(url),
        post_tags(tag:tags(name, slug))
      `,
        { count: "exact" },
      )
      .eq(isProfile ? "author_id" : "persona_id", profileOrPersonaId)
      .in("status", ["PUBLISHED", "DELETED"])
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    const { data: postData, count } = await query;
    postsCount = count ?? 0;

    const rawPosts = (Array.isArray(postData) ? (postData as unknown[]) : []).filter(isRawPost);
    const postIds = rawPosts.map((p) => p.id);
    const {
      votes: userVotes,
      hiddenPostIds,
      savedPostIds,
    } = currentUser
      ? await fetchUserInteractions(supabase, currentUser.id, postIds)
      : { votes: {}, hiddenPostIds: new Set<string>(), savedPostIds: new Set<string>() };

    posts = rawPosts.map((p) =>
      transformPostToFeedFormat(p, {
        userVote: toVoteValue(userVotes[p.id]),
        isHidden: hiddenPostIds.has(p.id),
        isSaved: savedPostIds.has(p.id),
      }),
    );
  } else if (tab === "comments") {
    const { count } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq(isProfile ? "author_id" : "persona_id", profileOrPersonaId);
    commentsCount = count ?? 0;
  } else if (tab === "saved" && isOwnProfile && currentUser) {
    const { data: savedData, count } = await supabase
      .from("saved_posts")
      .select(
        `
        post_id,
        posts (
          id, title, body, created_at, score, comment_count, author_id, persona_id, status,
          boards(name, slug),
          profiles(display_name, avatar_url, username),
           personas(display_name, avatar_url, username),
           media(url),
           post_tags(tag:tags(name, slug))
         )
      `,
        { count: "exact" },
      )
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    savedCount = count ?? 0;
    type SavedRow = { posts: RawPost | RawPost[] | null };
    const savedPostsData = (Array.isArray(savedData) ? (savedData as unknown[]) : [])
      .filter((row): row is SavedRow => !!row && typeof row === "object" && "posts" in row)
      .map((s) => (Array.isArray(s.posts) ? s.posts[0] : s.posts))
      .filter(isRawPost);
    const postIds = savedPostsData.map((p) => p.id);
    const {
      votes: userVotes,
      hiddenPostIds,
      savedPostIds,
    } = await fetchUserInteractions(supabase, currentUser.id, postIds);

    posts = savedPostsData.map((p) =>
      transformPostToFeedFormat(p, {
        userVote: toVoteValue(userVotes[p.id]),
        isHidden: hiddenPostIds.has(p.id),
        isSaved: savedPostIds.has(p.id),
      }),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-0 pb-8 sm:px-2">
      <section className="border-neutral bg-base-100 overflow-hidden rounded-2xl border">
        <div className="from-neutral/30 to-neutral/10 h-20 bg-gradient-to-br" />
        <div className="-mt-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="flex items-end gap-4">
            <div className="-mt-8">
              <Avatar
                fallbackSeed={displayName}
                src={avatarUrl ?? undefined}
                size="lg"
                className="rounded-full bg-white"
                isPersona={!isProfile}
              />
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-base-content text-2xl font-bold">{displayName}</h1>
                {!isProfile && (
                  <span className="bg-info/10 text-info rounded px-2 py-0.5 text-xs font-bold">
                    AI PERSONA
                  </span>
                )}
              </div>
              <p className="text-base-content/70 text-sm">u/{usernameDisplay}</p>
            </div>
          </div>

          {!isOwnProfile && isProfile && profileOrPersonaId && (
            <div className="flex gap-2">
              <FollowButton
                userId={profileOrPersonaId}
                initialIsFollowing={isFollowing}
                currentUserId={currentUser?.id}
              />
            </div>
          )}

          {isOwnProfile && (
            <div>
              <Link
                href="/settings/profile"
                className="bg-base-300 text-base-content hover:bg-base-200 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              >
                Edit Profile
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="border-neutral bg-base-100 scrollbar-hide overflow-x-auto rounded-full border p-1">
        <div className="flex min-w-max items-center gap-1">
          {[
            { key: "posts", label: "Posts" },
            { key: "comments", label: "Comments" },
            ...(isOwnProfile ? [{ key: "saved", label: "Saved" }] : []),
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
        <section className="space-y-4">
          <ProfilePostList
            posts={posts}
            comments={comments}
            displayName={displayName}
            username={usernameDisplay}
            tab={tab}
            userId={currentUser?.id}
            authorId={isProfile ? profileOrPersonaId : undefined}
            personaId={!isProfile ? profileOrPersonaId : undefined}
            isOwnProfile={isOwnProfile}
            postsCount={postsCount}
            commentsCount={commentsCount}
            savedCount={savedCount}
          />
        </section>

        <aside className="space-y-4">
          <div className="border-neutral bg-base-100 rounded-2xl border p-4">
            <h3 className="text-base-content/70 text-sm font-bold tracking-wide uppercase">
              About
            </h3>
            <p className="text-base-content mt-3 text-sm">
              {bio?.trim() || `This ${isProfile ? "user" : "persona"} has not added a bio yet.`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {isProfile && (
                <>
                  <div className="bg-base-300 rounded-xl p-3">
                    <div className="text-base-content font-semibold">{karma}</div>
                    <div className="text-base-content/70 text-xs">Karma</div>
                  </div>
                  <div className="bg-base-300 rounded-xl p-3">
                    <div className="text-base-content font-semibold">{followersCount}</div>
                    <div className="text-base-content/70 text-xs">Followers</div>
                  </div>
                </>
              )}
              <div className="bg-base-300 col-span-2 rounded-xl p-3">
                <div className="text-base-content flex items-center gap-2">
                  <CalendarClock size={16} />
                  <span className="font-semibold">
                    {isProfile ? `Joined ${joinYear}` : `Created ${joinYear}`}
                  </span>
                </div>
                <div className="text-base-content/70 mt-1 flex items-center gap-2 text-xs">
                  <Flame size={14} />
                  {isProfile ? "Profile activity will appear here." : "AI-generated persona"}
                </div>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <div className="border-neutral bg-base-100 rounded-2xl border p-2">
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/settings/profile"
                    className="text-base-content hover:bg-base-300 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors"
                  >
                    <Settings size={16} className="text-base-content/70" />
                    Settings
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/avatar"
                    className="text-base-content hover:bg-base-300 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors"
                  >
                    <UserRound size={16} className="text-base-content/70" />
                    Update avatar
                  </Link>
                </li>
                <li>
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="text-base-content hover:bg-base-300 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors"
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
