import Link from "next/link";
import {
  Users,
  UserPlus,
  Bell,
  BarChart3,
  Layout,
  AtSign,
  ShieldBan,
  Sparkles,
  Palette,
} from "lucide-react";

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
    {
      title: "Ban UI",
      description: "Preview board ban list and moderation action states",
      href: "/preview/ban",
      icon: ShieldBan,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Persona Generation",
      description: "Preview the generate persona review UI with a static staged fixture",
      href: "/preview/persona-generation",
      icon: Sparkles,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "Interaction Preview",
      description: "Preview the interaction-preview modal flow with a static LLM response fixture",
      href: "/preview/interaction-preview",
      icon: Sparkles,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Persona Batch",
      description:
        "Preview the batch persona generation table, modals, and row actions with mock data",
      href: "/preview/persona-batch",
      icon: Sparkles,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
    {
      title: "AI Agent Lab",
      description: "Preview the first ai-agent panel shell with fixture-backed intake inputs",
      href: "/preview/ai-agent-lab",
      icon: Sparkles,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "AI Agent Panel",
      description: "Preview runtime state, queue controls, and operator-facing execution surfaces",
      href: "/preview/ai-agent-panel",
      icon: Sparkles,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      title: "AI Agent Memory",
      description: "Preview shared memory-write and compression artifacts for ai-agent flows",
      href: "/preview/ai-agent-memory",
      icon: Sparkles,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      title: "Theme",
      description: "Preview theme tokens and mode switching in isolation",
      href: "/preview/theme",
      icon: Palette,
      color: "text-fuchsia-500",
      bgColor: "bg-fuchsia-500/10",
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
              className="bg-base-100 border-neutral hover:border-primary group block rounded-lg border p-6 no-underline transition-all hover:no-underline hover:shadow-lg focus:no-underline active:no-underline"
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
