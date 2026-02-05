import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";

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

  return (
    <div className="min-h-screen bg-[#0B1416]">
      {/* Profile Header (Top section) */}
      <div className="flex items-center gap-4 px-4 py-4 md:px-0">
        {/* Avatar */}
        <div className="relative h-20 w-20 rounded-full bg-[#2A3C42] border-4 border-[#0B1416]">
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            🐰
          </div>
          <div className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-[#FF4500] border-2 border-[#0B1416] flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3 h-3 text-white"
            >
              <path
                fillRule="evenodd"
                d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[#D7DADC] flex items-center gap-2">
            {displayName}
          </h1>
          <p className="text-sm text-[#818384]">{username}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#343536] px-4 md:px-0">
        <button className="border-b-2 border-[#D7DADC] px-4 py-3 text-sm font-bold text-[#D7DADC]">
          Overview
        </button>
        <button className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#818384] hover:bg-[#1A282D] hover:text-[#D7DADC]">
          Posts
        </button>
        <button className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#818384] hover:bg-[#1A282D] hover:text-[#D7DADC]">
          Comments
        </button>
        <button className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#818384] hover:bg-[#1A282D] hover:text-[#D7DADC]">
          Saved
        </button>
        <button className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#818384] hover:bg-[#1A282D] hover:text-[#D7DADC]">
          History
        </button>
        <button className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#818384] hover:bg-[#1A282D] hover:text-[#D7DADC]">
          Hidden
        </button>
        <button className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#818384] hover:bg-[#1A282D] hover:text-[#D7DADC]">
          Upvoted
        </button>
        <button className="border-b-2 border-transparent px-4 py-3 text-sm font-bold text-[#818384] hover:bg-[#1A282D] hover:text-[#D7DADC]">
          Downvoted
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        {/* Left Content (Feed) */}
        <div className="flex-1 space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between rounded-md border border-[#343536] bg-[#1A282D] p-2">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 rounded-full bg-[#2A3C42] px-3 py-1.5 text-xs font-bold text-[#D7DADC] hover:bg-[#3A4E56]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
                New
              </button>
              <button className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-[#818384] hover:bg-[#2A3C42]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
                  />
                </svg>
                Hot
              </button>
            </div>
          </div>

          {/* Empty State */}
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#343536] bg-[#0B1416] py-20">
            <div className="mb-4 text-6xl opacity-20">👻</div>
            <h3 className="mb-2 text-xl font-medium text-[#D7DADC]">
              u/{displayName} hasn't posted yet
            </h3>
            <p className="text-sm text-[#818384]">
              Be the first to see what they post!
            </p>
          </div>
        </div>

        {/* Right Sidebar (Profile Card) */}
        <div className="w-full lg:w-[350px]">
          <div className="rounded-md border border-[#343536] bg-[#1A282D] overflow-hidden">
            {/* Banner */}
            <div className="h-24 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 relative">
              <button className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {/* Name & Share */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-[#D7DADC] mb-3">
                  {displayName}
                </h2>
                <button className="flex items-center gap-2 rounded-full border border-[#D7DADC] px-4 py-1 text-sm font-bold text-[#D7DADC] hover:bg-[#2A3C42]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                    />
                  </svg>
                  Share
                </button>
              </div>

              {/* Stats */}
              <div className="mb-6 space-y-4">
                <div className="text-sm font-medium text-[#D7DADC]">
                  0 followers
                </div>
                <div className="grid grid-cols-2 gap-y-4">
                  <div>
                    <div className="text-base font-medium text-[#D7DADC]">
                      1
                    </div>
                    <div className="text-xs text-[#818384]">Karma</div>
                  </div>
                  <div>
                    <div className="text-base font-medium text-[#D7DADC]">
                      0
                    </div>
                    <div className="text-xs text-[#818384]">Contributions</div>
                  </div>
                  <div>
                    <div className="text-base font-medium text-[#D7DADC]">
                      5 y
                    </div>
                    <div className="text-xs text-[#818384]">Reddit Age</div>
                  </div>
                  <div>
                    <div className="text-base font-medium text-[#D7DADC]">
                      0
                    </div>
                    <div className="text-xs text-[#818384]">Active in &gt;</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-base font-medium text-[#D7DADC]">
                      0
                    </div>
                    <div className="text-xs text-[#818384]">Gold earned</div>
                  </div>
                </div>
              </div>

              <hr className="border-[#343536] mb-4" />

              {/* Achievements */}
              <div className="mb-6">
                <h3 className="text-xs font-bold text-[#818384] uppercase mb-3">
                  Achievements
                </h3>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-10 w-10 rounded-full bg-yellow-500 border-2 border-yellow-300"></div>
                  <div className="h-10 w-10 rounded-full bg-orange-500 border-2 border-orange-300 -ml-4"></div>
                  <div className="h-10 w-10 rounded-full bg-blue-400 border-2 border-blue-200 -ml-4"></div>
                  <div className="text-xs text-[#D7DADC] ml-2">
                    Banana Beginner, Banana Baby, Person of Interests, +5 more
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#818384]">8 unlocked</span>
                  <button className="rounded-full bg-[#2A3C42] px-3 py-1.5 text-xs font-bold text-[#D7DADC] hover:bg-[#3A4E56]">
                    View All
                  </button>
                </div>
              </div>

              <hr className="border-[#343536] mb-4" />

              {/* Settings */}
              <div>
                <h3 className="text-xs font-bold text-[#818384] uppercase mb-3">
                  Settings
                </h3>
                <div className="space-y-4">
                  {/* Profile */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white text-xs">🐰</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#D7DADC]">
                          Profile
                        </div>
                        <div className="text-xs text-[#818384]">
                          Customize your profile
                        </div>
                      </div>
                    </div>
                    <button className="rounded-full bg-[#2A3C42] px-3 py-1.5 text-xs font-bold text-[#D7DADC] hover:bg-[#3A4E56]">
                      Update
                    </button>
                  </div>

                  {/* Avatar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-transparent border border-[#818384] flex items-center justify-center text-[#D7DADC]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#D7DADC]">
                          Avatar
                        </div>
                        <div className="text-xs text-[#818384]">
                          Style your avatar
                        </div>
                      </div>
                    </div>
                    <button className="rounded-full bg-[#2A3C42] px-3 py-1.5 text-xs font-bold text-[#D7DADC] hover:bg-[#3A4E56]">
                      Update
                    </button>
                  </div>

                  {/* Change Theme */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-transparent border border-[#818384] flex items-center justify-center text-[#D7DADC]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#D7DADC]">
                          Dark Mode
                        </div>
                        <div className="text-xs text-[#818384]">
                          Change theme
                        </div>
                      </div>
                    </div>
                    <button className="rounded-full bg-[#2A3C42] px-3 py-1.5 text-xs font-bold text-[#D7DADC] hover:bg-[#3A4E56]">
                      Toggle
                    </button>
                  </div>

                  {/* Log Out */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-transparent border border-[#818384] flex items-center justify-center text-[#D7DADC]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#D7DADC]">
                          Log Out
                        </div>
                      </div>
                    </div>
                    <form action="/auth/signout" method="post">
                      <button className="rounded-full bg-[#2A3C42] px-3 py-1.5 text-xs font-bold text-[#D7DADC] hover:bg-[#3A4E56]">
                        Logout
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
