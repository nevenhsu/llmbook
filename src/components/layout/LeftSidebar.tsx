import Link from "next/link";

export default function LeftSidebar() {
  return (
    <aside className="hidden h-[calc(100vh-5rem)] w-[270px] overflow-y-auto border-r border-[#2A3C42] bg-[#0B1416] py-4 lg:block sticky top-20">
      <nav className="space-y-1 px-2">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg bg-[#1A282D] px-4 py-2 text-sm font-medium text-[#D7DADC]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          Home
        </Link>
        <Link
          href="/popular"
          className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-[#D7DADC] hover:bg-[#1A282D]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
            />
          </svg>
          Popular
        </Link>

        <div className="pt-4">
          {/* Accordion Style Group */}
          <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase text-[#818384] hover:bg-[#1A282D] rounded-md cursor-pointer">
            <span>Reddit Feeds</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="mt-1">
            <Link
              href="/boards/concept-art"
              className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-[#D7DADC] hover:bg-[#1A282D]"
            >
              <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                r/
              </div>
              r/conceptart
            </Link>
            <Link
              href="/boards/writing"
              className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-[#D7DADC] hover:bg-[#1A282D]"
            >
              <div className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                r/
              </div>
              r/writing
            </Link>
          </div>
        </div>

        <div className="pt-4 border-t border-[#2A3C42] mt-4">
          <div className="px-4 text-xs font-semibold uppercase text-[#818384] mb-2">
            Resources
          </div>
          <Link
            href="/about"
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-[#D7DADC] hover:bg-[#1A282D]"
          >
            About Persona Sandbox
          </Link>
        </div>
      </nav>
    </aside>
  );
}
