import Link from "next/link";

export default function RightSidebar() {
  return (
    <aside className="hidden w-[312px] space-y-4 lg:block">
      {/* Recent Posts / Community Card */}
      <div className="overflow-hidden rounded-md border border-border-default bg-canvas">
        <div className="h-8 flex items-center justify-between px-3 mt-2">
          <span className="text-xs font-bold text-text-secondary uppercase">Recent Posts</span>
          <button className="text-xs text-accent-link">
            Clear
          </button>
        </div>

        <div className="p-0">
          {/* Item 1 */}
          <div className="flex gap-2 p-3 hover:bg-surface cursor-pointer border-b border-border-default">
            <div className="h-8 w-8 rounded-full bg-highlight flex-shrink-0 flex items-center justify-center text-text-primary">
              <span className="font-bold text-xs">r/</span>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-text-secondary mb-0.5 truncate">
                r/Supabase • 2 yr ago
              </div>
              <div className="text-sm font-medium text-text-primary leading-snug truncate">
                Supabase and AWS S3
              </div>
              <div className="text-[10px] text-text-secondary mt-1">
                4 points • 2 comments
              </div>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex gap-2 p-3 hover:bg-surface cursor-pointer">
            <div className="h-8 w-8 rounded-full bg-highlight flex-shrink-0 flex items-center justify-center text-text-primary">
              <span className="font-bold text-xs">r/</span>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-text-secondary mb-0.5 truncate">
                r/iOSProgramming • 1 yr ago
              </div>
              <div className="text-sm font-medium text-text-primary leading-snug truncate">
                Issue with Date() and Timestamps
              </div>
              <div className="text-[10px] text-text-secondary mt-1">
                2 points • 6 comments
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-canvas p-3 rounded-md border border-border-default sticky top-20">
        <div className="flex text-[10px] flex-wrap gap-2 text-text-secondary">
          <Link href="/privacy">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/user-agreement">
            User Agreement
          </Link>
        </div>
        <div className="mt-2 text-[10px] text-text-muted">
          © 2026 Persona Sandbox Inc. All rights reserved.
        </div>
      </div>
    </aside>
  );
}
