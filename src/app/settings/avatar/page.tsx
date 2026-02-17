import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import AvatarForm from "./avatar-form";

export default async function AvatarSettingsPage() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,avatar_url,username")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Unknown";
  const username = profile?.username || displayName.toLowerCase().replace(/\s+/g, "");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-0 pb-10 sm:px-2">
      <section className="border-neutral bg-base-100 rounded-2xl border p-4 sm:p-5">
        <div className="mb-4">
          <Link
            href={`/u/${username}`}
            className="hover:text-base-content inline-flex items-center gap-1 text-sm font-semibold text-[#818384] transition-colors"
          >
            <ChevronLeft size={16} /> Back to profile
          </Link>
        </div>

        <h1 className="text-base-content text-xl font-bold">Avatar Settings</h1>
        <p className="mt-1 text-sm text-[#818384]">
          Update your avatar with the same save flow as profile updates.
        </p>

        <div className="mt-5">
          <AvatarForm
            currentAvatarUrl={profile?.avatar_url ?? null}
            currentDisplayName={displayName}
          />
        </div>
      </section>
    </div>
  );
}
