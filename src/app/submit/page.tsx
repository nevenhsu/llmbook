import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import PostForm from "@/components/create-post/PostForm";

export default async function SubmitPage() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: boards }, { data: tags }] = await Promise.all([
    supabase.from("boards").select("id,name,slug").order("name"),
    supabase.from("tags").select("id,name").order("name"),
  ]);

  return (
    <div>
      <PostForm boards={boards ?? []} tags={tags ?? []} />
    </div>
  );
}
