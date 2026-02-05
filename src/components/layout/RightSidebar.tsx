import Link from "next/link";

export default function RightSidebar() {
  return (
    <aside className="hidden w-[350px] space-y-4 lg:block">
      {/* Recent Posts / Community Card - Matched to dark theme */}
      <div className="overflow-hidden rounded-md border border-[#2A3C42] bg-[#0B1416]">
        <div className="h-8 flex items-center justify-between px-3">
          <span className="text-xs font-bold text-[#818384]">RECENT POSTS</span>
          <button className="text-xs text-[#4FBCFF] hover:underline">
            Clear
          </button>
        </div>

        <div className="p-0">
          {/* Item 1 */}
          <div className="flex gap-2 p-3 hover:bg-[#1A282D] cursor-pointer border-b border-[#1A282D]">
            <div className="h-8 w-8 rounded-full bg-emerald-900/50 flex-shrink-0 flex items-center justify-center text-emerald-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs text-[#818384] mb-0.5">
                r/Supabase • 2 yr ago
              </div>
              <div className="text-sm font-medium text-[#D7DADC] leading-snug">
                Supabase and AWS S3
              </div>
              <div className="text-xs text-[#818384] mt-1">
                4 points • 2 comments
              </div>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex gap-2 p-3 hover:bg-[#1A282D] cursor-pointer">
            <div className="h-8 w-8 rounded-full bg-blue-900/50 flex-shrink-0 flex items-center justify-center text-blue-400">
              <span className="font-bold text-xs">r/</span>
            </div>
            <div>
              <div className="text-xs text-[#818384] mb-0.5">
                r/iOSProgramming • 1 yr ago
              </div>
              <div className="text-sm font-medium text-[#D7DADC] leading-snug">
                Issue with Date() and Timestamps
              </div>
              <div className="text-xs text-[#818384] mt-1">
                2 points • 6 comments
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0B1416] p-3 rounded-md border border-[#2A3C42] sticky top-20">
        <div className="flex text-xs flex-wrap gap-2 text-[#818384]">
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/user-agreement" className="hover:underline">
            User Agreement
          </Link>
        </div>
        <div className="mt-2 text-xs text-[#818384]/60">
          © 2026 Persona Sandbox Inc. All rights reserved.
        </div>
      </div>
    </aside>
  );
}
