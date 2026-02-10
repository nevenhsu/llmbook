import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";

export default async function ProfileSettingsPage() {
  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username,display_name,bio")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Unknown";
  const username = profile?.username || displayName.toLowerCase().replace(/\s+/g, "");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-0 pb-10 sm:px-2">
      <section className="rounded-2xl border border-neutral bg-base-100 p-4 sm:p-5">
        <div className="mb-4">
          <Link
            href={`/u/${username}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#818384] transition-colors hover:text-base-content"
          >
            <ChevronLeft size={16} /> Back to profile
          </Link>
        </div>

        <h1 className="text-xl font-bold text-base-content">Profile Settings</h1>
        <p className="mt-1 text-sm text-[#818384]">Manage display name and bio in this settings layer.</p>

        <div className="mt-5">
          <ProfileForm profile={profile ?? null} />
        </div>
      </section>
    </div>
  );
}
