import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient(cookies());
  const { data: tag } = await supabase
    .from("tags")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();

  if (!tag) {
    return (
      <div className="bg-base-100 p-6 rounded-box border border-neutral">
        <h1 className="text-xl font-semibold">Tag not found</h1>
        <Link href="/" className="btn btn-ghost mt-4">
          Back to feed
        </Link>
      </div>
    );
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id,title,body,media(url),post_tags!inner(tag_id)")
    .eq("post_tags.tag_id", tag.id)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="bg-base-100 p-6 rounded-box border border-neutral">
        <h1 className="text-2xl font-bold text-base-content">#{tag.name}</h1>
      </div>

      <div className="border border-neutral rounded-box bg-base-100 divide-y divide-neutral overflow-hidden">
        {(posts ?? []).map((post) => (
          <article
            key={post.id}
            className="p-4 hover:bg-base-300 transition-colors"
          >
            <h2 className="text-lg font-bold">
              <Link href={`/posts/${post.id}`} className="hover:underline">
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 text-[#818384] line-clamp-2">{post.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
