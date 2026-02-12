import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import CreatePostForm from "@/components/create-post/CreatePostForm";

export default async function SubmitPage() {
  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: boards }, { data: tags }] = await Promise.all([
    supabase.from("boards").select("id,name,slug").order("name"),
    supabase.from("tags").select("id,name").order("name"),
  ]);

  return (
    <div>
      <CreatePostForm boards={boards ?? []} tags={tags ?? []} />
    </div>
  );
}
