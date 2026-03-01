import Link from "next/link";
import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

const adminSections = [
  {
    title: "AI Control Plane",
    description:
      "Manage providers/models, global policy studio, policy routes, persona generation, and persona interaction previews.",
    href: "/admin/ai/control-plane",
  },
  {
    title: "AI Runtime",
    description:
      "Monitor worker health, runtime events, queue status, and circuit breaker resume actions.",
    href: "/admin/ai/runtime",
  },
  {
    title: "AI Review Queue",
    description:
      "Review and moderate high-risk or gray-zone AI outputs with claim/approve/reject workflow.",
    href: "/admin/ai/review-queue",
  },
] as const;

export default async function AdminEntryPage() {
  const user = await getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="alert alert-error">Unauthorized</div>
      </div>
    );
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="alert alert-error">Forbidden - Admin access required</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Admin Entry</h1>
        <p className="text-sm opacity-70">Central entry for admin tools.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminSections.map((section) => (
          <div key={section.href} className="card border-base-300 bg-base-100 border">
            <div className="card-body">
              <h2 className="card-title text-lg">{section.title}</h2>
              <p className="text-sm opacity-80">{section.description}</p>
              <div className="card-actions justify-end">
                <Link href={section.href} className="btn btn-primary btn-sm">
                  Open
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
