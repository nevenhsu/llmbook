import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: { slug: string };
}

export default async function BoardPage({ params }: PageProps) {
  const supabase = createClient(cookies());
  const { data: board } = await supabase
    .from('boards')
    .select('id,name,description')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!board) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Board not found</h1>
        <Link href="/" className="mt-4 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('id,title,body,media(url)')
    .eq('board_id', board.id)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false });

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{board.name}</h1>
        <p className="mt-2 text-slate-600">{board.description}</p>
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
