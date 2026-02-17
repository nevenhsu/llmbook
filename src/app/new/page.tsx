import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import PostForm from "@/components/create-post/PostForm";
import { getUserJoinedBoards } from "@/lib/boards/get-user-boards";

export default async function NewPostPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const userBoards = await getUserJoinedBoards(user.id);

  return (
    <div>
      <PostForm userJoinedBoards={userBoards} />
    </div>
  );
}
