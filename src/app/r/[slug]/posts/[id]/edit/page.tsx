import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import PostForm from "@/components/create-post/PostForm";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EditPostPage({ params }: PageProps) {
  const { slug, id } = await params;
  const supabase = await createClient(cookies());

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the post
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select(
      `
      id,
      title,
      body,
      board_id,
      author_id,
      persona_id,
      post_type,
      status,
      boards(id, slug),
      personas(id, username),
      post_tags(tag_id),
      media(id, url, width, height, file_size),
      poll_options(id, option_text, vote_count)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (postError || !post) {
    notFound();
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

  // Check if post is deleted - show deleted state instead of notFound
  const isDeleted = post.status === "DELETED";

  // Fetch all boards and tags for the form
  const [{ data: boards }, { data: tags }] = await Promise.all([
    supabase.from("boards").select("id,name,slug").order("name"),
    supabase.from("tags").select("id,name").order("name"),
  ]);

  // Prepare initial data for the form
  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  const tagIds = post.post_tags?.map((pt: any) => pt.tag_id) || [];
  
  // Format media
  const mediaFormatted = post.media?.map((m: any) => ({
    mediaId: m.id,
    url: m.url,
    width: m.width,
    height: m.height,
    sizeBytes: m.file_size,
  })) || [];

  // Format poll options
  const pollOptionsFormatted = post.poll_options?.map((opt: any) => ({
    id: opt.id,
    option_text: opt.option_text,
    vote_count: opt.vote_count,
  })) || [];

  // If deleted, show deleted message
  if (isDeleted) {
    return (
      <div className="mx-auto max-w-[740px] pb-20 sm:pb-10 px-4 sm:px-0">
        <div className="py-6">
          <h1 className="text-2xl font-bold text-base-content mb-2">
            {post.title}
          </h1>
          <div className="rounded-xl border border-warning bg-warning/10 p-6 text-center">
            <p className="text-lg font-semibold text-warning mb-2">
              This post has been deleted
            </p>
            <p className="text-sm text-base-content/70">
              The content of this post is no longer available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const initialData = {
    postId: post.id,
    title: post.title,
    body: post.body || "",
    boardId: post.board_id,
    boardSlug: board?.slug || slug,
    tagIds,
    postType: post.post_type,
    media: mediaFormatted,
    pollOptions: pollOptionsFormatted,
  };

  return (
    <div>
      <PostForm
        boards={boards ?? []}
        tags={tags ?? []}
        editMode={true}
        initialData={initialData}
      />
    </div>
  );
}
