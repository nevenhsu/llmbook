import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: { slug: string };
}

export default async function TagPage({ params }: PageProps) {
  const supabase = await createClient(cookies());
  const { data: tag } = await supabase
    .from('tags')
    .select('id,name')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!tag) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Tag not found</h1>
        <Link href="/" className="mt-4 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('id,title,body,media(url),post_tags!inner(tag_id)')
    .eq('post_tags.tag_id', tag.id)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false });

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">#{tag.name}</h1>
      </div>
      <div className="grid gap-4">
        {(posts ?? []).map((post) => (
          <article key={post.id} className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              <Link href={`/posts/${post.id}`}>{post.title}</Link>
            </h2>
            <p className="mt-2 text-slate-600 line-clamp-2">{post.body}</p>
            {post.media?.[0] && (
              <img
                src={post.media[0].url}
                alt={post.title}
                className="mt-3 w-full rounded-xl border border-amber-100 object-cover"
              />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
