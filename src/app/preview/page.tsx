import Link from "next/link";
import { Users, UserPlus, Bell, BarChart3, Layout, AtSign } from "lucide-react";

export default function PreviewIndexPage() {
  const previewPages = [
    {
      title: "Followers",
      description: "Preview the followers list UI with mock data",
      href: "/preview/followers",
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Following",
      description: "Preview the following list UI with mock data",
      href: "/preview/following",
      icon: UserPlus,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Notifications",
      description: "Preview notification items and bell dropdown",
      href: "/preview/notifications",
      icon: Bell,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Pagination",
      description: "Preview pagination patterns and examples",
      href: "/preview/pagination",
      icon: BarChart3,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Poll",
      description: "Preview poll creation and voting UI",
      href: "/preview/poll",
      icon: Layout,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      title: "Mention Suggestions",
      description: "Preview mention dropdown with different states",
      href: "/preview/mentions",
      icon: AtSign,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">UI Preview Pages</h1>
        <p className="text-base-content/70">
          Preview and test UI components with mock data before integration
        </p>
      </div>

      {/* Preview Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {previewPages.map((page) => {
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              className="bg-base-100 border-neutral hover:border-primary group block rounded-lg border p-6 transition-all hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className={`${page.bgColor} rounded-lg p-3`}>
                  <Icon size={24} className={page.color} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base-content group-hover:text-primary mb-1 text-lg font-semibold transition-colors">
                    {page.title}
                  </h3>
                  <p className="text-base-content/60 text-sm">{page.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info Panel */}
      <div className="bg-base-200 border-neutral mt-8 rounded-lg border p-6">
        <h2 className="text-base-content mb-3 text-lg font-semibold">About Preview Pages</h2>
        <div className="text-base-content/70 space-y-2 text-sm">
          <p>
            Preview pages allow you to test UI components in isolation with mock data before
            integrating them into the main application.
          </p>
          <p className="mt-3">
            <strong>Features:</strong>
          </p>
          <ul className="ml-6 list-disc space-y-1">
            <li>Interactive controls to toggle different states</li>
            <li>Mock data for realistic testing</li>
            <li>No database dependency</li>
            <li>Easy to modify and experiment</li>
          </ul>
        </div>
      </div>

      {/* Development Notes */}
      <div className="bg-info/10 border-info mt-4 rounded-lg border p-6">
        <h2 className="text-info mb-3 text-sm font-bold tracking-wider uppercase">
          Development Notes
        </h2>
        <div className="text-base-content/70 space-y-2 text-sm">
          <p>
            <strong>Location:</strong>{" "}
            <code className="bg-base-300 rounded px-2 py-1">/src/app/preview/*</code>
          </p>
          <p>
            <strong>Purpose:</strong> Component development, UI testing, and documentation
          </p>
          <p>
            <strong>Access:</strong> Development only (should be blocked in production via
            middleware)
          </p>
        </div>
      </div>
    </div>
  );
}
