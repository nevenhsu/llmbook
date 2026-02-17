import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import PostForm from "@/components/create-post/PostForm";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { getPostForEdit } from "@/lib/posts/get-post-by-id";
import type { PostPageProps } from "@/types/pages";

export default async function EditPostPage({ params }: PostPageProps) {
  const { slug, id } = await params;
  const board = await getBoardBySlug(slug);

  if (!board) {
    notFound();
  }

  // Check authentication
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the post
  const { data: post, error: postError } = await getPostForEdit(id, board.id);

  if (postError || !post) {
    notFound();
  }

  // Check if post is deleted - show deleted state immediately before any more DB queries
  if (post.status === "DELETED") {
    return (
      <div className="mx-auto max-w-[740px] px-4 pb-20 sm:px-0 sm:pb-10">
        <div className="py-6">
          <h1 className="text-base-content mb-2 text-2xl font-bold">{post.title}</h1>
          <div className="border-warning bg-warning/10 rounded-xl border p-6 text-center">
            <p className="text-warning mb-2 text-lg font-semibold">This post has been deleted</p>
            <p className="text-base-content/70 text-sm">
              The content of this post is no longer available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check permissions
  const isPersonaPost = !!post.persona_id;

  // TODO: Persona posts editing - currently not supported
  // Need to determine: who can edit persona posts? Admin only? Board moderators?
  if (isPersonaPost) {
    redirect(`/r/${slug}/posts/${id}`);
  }

  // For user posts: check if user is the author
  const canEdit = post.author_id === user.id;

  if (!canEdit) {
    redirect(`/r/${slug}/posts/${id}`);
  }

  // Prepare initial data for the form
  const tagIds = post.post_tags?.map((pt: any) => pt.tag_id) || [];

  // Format media
  const mediaFormatted =
    post.media?.map((m: any) => ({
      mediaId: m.id,
      url: m.url,
      width: m.width,
      height: m.height,
      sizeBytes: m.size_bytes,
    })) || [];

  // Format poll options
  const pollOptionsFormatted =
    post.poll_options?.map((opt: any) => ({
      id: opt.id,
      text: opt.text,
      voteCount: opt.vote_count,
    })) || [];

  const initialData = {
    postId: post.id,
    title: post.title,
    body: post.body || "",
    boardId: board.id,
    boardSlug: board.slug,
    boardName: board.name,
    tagIds,
    postType: post.post_type as "text" | "poll",
    media: mediaFormatted,
    pollOptions: pollOptionsFormatted,
  };

  return (
    <div>
      <PostForm editMode={true} initialData={initialData} />
    </div>
  );
}
